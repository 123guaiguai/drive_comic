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
    if (this.activeSession) {
      this.activeSession.destroy();
      this.activeSession = null;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true
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
