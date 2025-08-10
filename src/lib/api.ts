import type { ClipboardItem, Device, ApiResponse, PaginatedResponse, PaginationParams } from '../../shared/types';

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * API请求工具类
 */
class ApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
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
    
    const response = await this.request<PaginatedResponse<ClipboardItem>>(
      `/clipboard?${searchParams.toString()}`
    );
    
    return response.data;
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

  // 设备相关API
  async getDevices(): Promise<Device[]> {
    const response = await this.request<Device[]>('/devices');
    return response.data;
  }

  async getDevice(deviceId: string): Promise<Device> {
    const response = await this.request<Device>(`/devices/${deviceId}`);
    return response.data;
  }

  async registerDevice(device: {
    deviceId: string;
    deviceName: string;
    userAgent: string;
  }): Promise<Device> {
    const response = await this.request<Device>('/devices', {
      method: 'POST',
      body: JSON.stringify(device),
    });
    return response.data;
  }

  async updateDeviceStatus(deviceId: string, isConnected: boolean): Promise<void> {
    await this.request(`/devices/${deviceId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isConnected }),
    });
  }

  async deleteDevice(deviceId: string): Promise<void> {
    await this.request(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
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
}

// 导出单例实例
export const apiClient = new ApiClient();
export default apiClient;