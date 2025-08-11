import type { ClipboardItem, ApiResponse, PaginatedResponse, PaginationParams } from '../../shared/types';
import { getApiBaseUrl } from './config';
import { useSecurityStore } from './security-store';

/**
 * API请求工具类
 */
class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${getApiBaseUrl()}${endpoint}`;

    // 获取安全配置的请求头
    const securityHeaders = useSecurityStore.getState().getHeaders();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...securityHeaders,
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '请求失败');
      }

      return data;
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  }

  // 剪切板相关API
  async getClipboardItems(params: PaginationParams & {
    type?: 'text' | 'image' | 'file';
    search?: string;
    deviceId?: string;
  } = {}): Promise<PaginatedResponse<ClipboardItem>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });

    const response = await this.request<{
      data: ClipboardItem[];
      total: number;
    }>(`/clipboard?${searchParams.toString()}`);

    // response 已经是完整的API响应，包含 success, data, total 等字段
    return response as unknown as PaginatedResponse<ClipboardItem>;
  }

  async getClipboardItem(id: string): Promise<ClipboardItem> {
    const response = await this.request<ClipboardItem>(`/clipboard/${id}`);
    return response.data;
  }

  async createClipboardItem(item: {
    type: 'text' | 'image' | 'file';
    content: string;
    deviceId: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }): Promise<ClipboardItem> {
    const response = await this.request<ClipboardItem>('/clipboard', {
      method: 'POST',
      body: JSON.stringify(item),
    });
    return response.data;
  }

  async deleteClipboardItem(id: string): Promise<void> {
    await this.request(`/clipboard/${id}`, {
      method: 'DELETE',
    });
  }

  async getTextItems(): Promise<ClipboardItem[]> {
    const response = await this.request<ClipboardItem[]>('/clipboard/text');
    return response.data;
  }

  async getImageItems(): Promise<ClipboardItem[]> {
    const response = await this.request<ClipboardItem[]>('/clipboard/images');
    return response.data;
  }

  async getLatestItems(count: number = 10): Promise<ClipboardItem[]> {
    const response = await this.request<ClipboardItem[]>(`/clipboard/latest?count=${count}`);
    return response.data;
  }

  // 连接统计API
  async getConnectionStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    connectedDevices: Array<{ deviceId: string; connectionId: string }>;
  }> {
    const response = await this.request<{
      totalConnections: number;
      activeConnections: number;
      connectedDevices: Array<{ deviceId: string; connectionId: string }>;
    }>('/devices/connections');
    return response.data;
  }

  // 配置相关API
  async getConfig(): Promise<Record<string, unknown>> {
    const response = await this.request<Record<string, unknown>>('/config');
    return response.data;
  }

  async updateConfig(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.request<Record<string, unknown>>('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
    return response.data;
  }

  async cleanupExpiredItems(params: {
    maxCount?: number;
    beforeDate?: string;
  }): Promise<{ deletedCount: number }> {
    const response = await this.request<{ deletedCount: number }>('/config/cleanup', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return response.data;
  }

  async getStorageStats(): Promise<{
    totalItems: number;
    textItems: number;
    imageItems: number;
    totalSize: string;
  }> {
    const response = await this.request<{
      totalItems: number;
      textItems: number;
      imageItems: number;
      totalSize: string;
    }>('/config/stats');
    return response.data;
  }

  async clearAllItems(): Promise<{ deletedCount: number }> {
    const response = await this.request<{ deletedCount: number }>('/config/clear-all', {
      method: 'DELETE',
    });
    return response.data;
  }

  // WebSocket安全配置相关API
  async setWebSocketSecurity(key: string, value: string): Promise<void> {
    await this.request('/config/websocket-security', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });
  }

  async clearWebSocketSecurity(): Promise<void> {
    await this.request('/config/websocket-security', {
      method: 'DELETE',
    });
  }
}

// 导出单例实例
export const apiClient = new ApiClient();
export default apiClient;