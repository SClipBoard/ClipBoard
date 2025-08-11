/**
 * 前端配置管理
 * 支持开发环境和生产环境的动态配置
 */

export interface ClientConfig {
  api: {
    baseUrl: string;
    port: number;
  };
  websocket: {
    port: number;
  };
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * 获取API基础URL
 */
export function getApiBaseUrl(): string {
  // 在开发环境中，使用Vite代理
  if (import.meta.env.DEV) {
    return '/api';
  }
  
  // 在生产环境中，使用当前域名和配置的端口
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = import.meta.env.VITE_API_PORT || '3001';
  
  return `${protocol}//${hostname}:${port}/api`;
}

/**
 * 获取WebSocket端口
 */
export function getWebSocketPort(): number {
  return parseInt(import.meta.env.VITE_WS_PORT || '3002', 10);
}

/**
 * 获取API端口
 */
export function getApiPort(): number {
  return parseInt(import.meta.env.VITE_API_PORT || '3001', 10);
}

/**
 * 生成WebSocket连接URL
 */
export function getWebSocketUrl(deviceId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname;
  const port = getWebSocketPort();
  
  return `${protocol}//${hostname}:${port}?deviceId=${deviceId}`;
}

/**
 * 获取完整的客户端配置
 */
export function getClientConfig(): ClientConfig {
  return {
    api: {
      baseUrl: getApiBaseUrl(),
      port: getApiPort(),
    },
    websocket: {
      port: getWebSocketPort(),
    },
    isDevelopment: import.meta.env.DEV,
    isProduction: import.meta.env.PROD,
  };
}

/**
 * 从服务器获取动态配置
 */
export async function fetchServerConfig(): Promise<{
  websocket: { port: number };
} | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/config/client`);
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return result.data;
      }
    }
  } catch (error) {
    console.warn('获取服务器配置失败，使用默认配置:', error);
  }
  return null;
}

/**
 * 检查服务器连接状态
 */
export async function checkServerConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/config/client`, {
      method: 'GET',
      timeout: 5000,
    } as RequestInit);
    return response.ok;
  } catch (error) {
    console.warn('服务器连接检查失败:', error);
    return false;
  }
}

// 导出默认配置
export default getClientConfig();
