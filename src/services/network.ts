import { Capacitor, CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';

export class NetworkClient {
  private static defaultUserAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  /**
   * Unified GET request
   */
  static async get<T = any>(
    url: string,
    options?: {
      headers?: Record<string, string>;
      params?: Record<string, string>;
      responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
    }
  ): Promise<{ data: T; status: number; headers: Record<string, string> }> {
    const headers = {
      'User-Agent': this.defaultUserAgent,
      ...(options?.headers || {})
    };

    let fullUrl = url;
    if (options?.params) {
      const query = Object.entries(options.params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + query;
    }

    if (Capacitor.isNativePlatform()) {
      const httpOptions: HttpOptions = {
        url: fullUrl,
        headers,
        responseType: options?.responseType || 'json'
      };
      const res: HttpResponse = await CapacitorHttp.get(httpOptions);
      return {
        data: res.data as T,
        status: res.status,
        headers: res.headers || {}
      };
    } else {
      // Browser fallback (for local preview/dev)
      const res = await fetch(fullUrl, {
        method: 'GET',
        headers
      });

      let data: any;
      if (options?.responseType === 'text') {
        data = await res.text();
      } else if (options?.responseType === 'blob') {
        data = await res.blob();
      } else {
        data = await res.json().catch(() => null);
      }

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });

      return {
        data,
        status: res.status,
        headers: responseHeaders
      };
    }
  }

  /**
   * Unified POST request
   */
  static async post<T = any>(
    url: string,
    data?: any,
    options?: {
      headers?: Record<string, string>;
      responseType?: 'json' | 'text';
    }
  ): Promise<{ data: T; status: number; headers: Record<string, string> }> {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': this.defaultUserAgent,
      ...(options?.headers || {})
    };

    if (Capacitor.isNativePlatform()) {
      const httpOptions: HttpOptions = {
        url,
        headers,
        data,
        responseType: options?.responseType || 'json'
      };
      const res: HttpResponse = await CapacitorHttp.post(httpOptions);
      return {
        data: res.data as T,
        status: res.status,
        headers: res.headers || {}
      };
    } else {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: typeof data === 'string' ? data : JSON.stringify(data)
      });

      let responseData: any;
      if (options?.responseType === 'text') {
        responseData = await res.text();
      } else {
        responseData = await res.json().catch(() => null);
      }

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });

      return {
        data: responseData,
        status: res.status,
        headers: responseHeaders
      };
    }
  }
}
