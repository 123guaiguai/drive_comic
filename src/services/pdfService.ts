import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { ComicPage } from '../types/comic';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      pdfWorker || `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  } catch (e) {
    console.warn('Failed to assign pdfWorker url, using CDN fallback:', e);
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  }
}

export class PdfDocumentSession {
  private pdfDoc: pdfjsLib.PDFDocumentProxy;
  public totalPages: number;
  private pageBlobUrls: Map<number, string> = new Map();
  private renderingTasks: Map<number, Promise<string>> = new Map();

  constructor(pdfDoc: pdfjsLib.PDFDocumentProxy) {
    this.pdfDoc = pdfDoc;
    this.totalPages = pdfDoc.numPages;
  }

  /**
   * Render a specific page to an Object URL (Blob)
   * @param pageNum 1-based page number
   * @param scale High-res scale (default 2.0 for Retina/OLED screens)
   */
  async renderPage(pageNum: number, scale: number = 2.0): Promise<string> {
    if (pageNum < 1 || pageNum > this.totalPages) {
      throw new Error(`页面超出范围: ${pageNum} / ${this.totalPages}`);
    }

    // Return cached URL if available
    const cached = this.pageBlobUrls.get(pageNum);
    if (cached) return cached;

    // Return in-flight render task if exists
    const existingTask = this.renderingTasks.get(pageNum);
    if (existingTask) return existingTask;

    const renderTask = (async () => {
      try {
        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('无法创建 Canvas 2D 上下文');

        // Fill white background before rendering
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport
        };

        await page.render(renderContext).promise;

        const blobUrl = await new Promise<string>((resolve) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                resolve(url);
              } else {
                // Fallback to data URL
                resolve(canvas.toDataURL('image/jpeg', 0.9));
              }
            },
            'image/jpeg',
            0.9
          );
        });

        this.pageBlobUrls.set(pageNum, blobUrl);
        return blobUrl;
      } finally {
        this.renderingTasks.delete(pageNum);
      }
    })();

    this.renderingTasks.set(pageNum, renderTask);
    return renderTask;
  }

  /**
   * Pre-render a batch of pages around current page (e.g. current ± 3)
   */
  preloadPages(centerPage: number, range: number = 3) {
    const minPage = Math.max(1, centerPage - range);
    const maxPage = Math.min(this.totalPages, centerPage + range);

    for (let p = minPage; p <= maxPage; p++) {
      if (!this.pageBlobUrls.has(p) && !this.renderingTasks.has(p)) {
        this.renderPage(p).catch((err) => {
          console.warn(`PDF 预加载第 ${p} 页失败:`, err);
        });
      }
    }
  }

  /**
   * Generate placeholder comic pages structure
   */
  generateComicPages(pdfTitle: string = 'PDF 漫画'): ComicPage[] {
    return Array.from({ length: this.totalPages }, (_, i) => {
      const pageIndex = i + 1;
      const cachedUrl = this.pageBlobUrls.get(pageIndex) || '';
      return {
        id: `pdf_p_${pageIndex}`,
        index: pageIndex,
        filename: `${pdfTitle} · 第 ${pageIndex} 页`,
        url: cachedUrl,
        downloadUrl: cachedUrl,
        loaded: !!cachedUrl,
        isPdfPage: true
      };
    });
  }

  /**
   * Clean up and revoke all blob URLs to free memory
   */
  destroy() {
    for (const url of this.pageBlobUrls.values()) {
      if (url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
    }
    this.pageBlobUrls.clear();
    this.renderingTasks.clear();
    try {
      this.pdfDoc.destroy();
    } catch {
      // ignore
    }
  }
}

export class PdfService {
  private static activeSession: PdfDocumentSession | null = null;

  /**
   * Load a PDF from ArrayBuffer and instantiate a session
   */
  static async loadPdfFromBuffer(buffer: ArrayBuffer): Promise<PdfDocumentSession> {
    if (!buffer || buffer.byteLength === 0) {
      throw new Error('下载的 PDF 文件为空 (0 字节)');
    }

    let uint8 = new Uint8Array(buffer);

    // Check if the buffer is actually an error response (JSON or HTML/XML)
    const headerSnippet = new TextDecoder('utf-8', { fatal: false }).decode(
      uint8.slice(0, Math.min(uint8.length, 2048))
    );

    // Check for JSON error response
    if (headerSnippet.trim().startsWith('{') || headerSnippet.trim().startsWith('[')) {
      try {
        const fullText = new TextDecoder('utf-8').decode(uint8);
        const json = JSON.parse(fullText);
        const msg = json.message || json.msg || json.errmsg || json.error || fullText;
        throw new Error(`网盘服务返回错误: ${msg}`);
      } catch (e: any) {
        if (e.message && e.message.startsWith('网盘服务返回错误:')) throw e;
      }
    }

    // Check for HTML/XML error page
    if (
      headerSnippet.includes('<html') ||
      headerSnippet.includes('<!DOCTYPE') ||
      headerSnippet.includes('<Error>') ||
      headerSnippet.includes('<d:error')
    ) {
      const titleMatch = headerSnippet.match(/<title>([^<]+)<\/title>/i);
      const msgMatch = headerSnippet.match(/<Message>([^<]+)<\/Message>/i);
      const reason = msgMatch?.[1] || titleMatch?.[1] || '服务器返回了网页错误页面而非 PDF 文件';
      throw new Error(`网盘返回异常: ${reason}`);
    }

    // Look for PDF magic header %PDF-
    let pdfStartIndex = -1;
    for (let i = 0; i <= Math.min(uint8.length - 5, 2048); i++) {
      if (
        uint8[i] === 0x25 && // %
        uint8[i + 1] === 0x50 && // P
        uint8[i + 2] === 0x44 && // D
        uint8[i + 3] === 0x46 && // F
        uint8[i + 4] === 0x2D // -
      ) {
        pdfStartIndex = i;
        break;
      }
    }

    if (pdfStartIndex === -1) {
      throw new Error('无效的 PDF 文件格式（未检测到 %PDF- 文件头）');
    }

    // If there is leading BOM or garbage before %PDF-, slice it
    if (pdfStartIndex > 0) {
      uint8 = uint8.slice(pdfStartIndex);
    }

    if (this.activeSession) {
      this.activeSession.destroy();
      this.activeSession = null;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: uint8,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
    });

    const pdfDoc = await loadingTask.promise;
    const session = new PdfDocumentSession(pdfDoc);
    this.activeSession = session;
    return session;
  }

  static getActiveSession(): PdfDocumentSession | null {
    return this.activeSession;
  }

  static closeActiveSession() {
    if (this.activeSession) {
      this.activeSession.destroy();
      this.activeSession = null;
    }
  }
}
