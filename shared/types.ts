// 剪切板内容项类型
export interface ClipboardItem {
  id: string;
  type: 'text' | 'image' | 'file';
  content: string;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  fileName?: string; // 文件名（仅文件类型）
  fileSize?: number; // 文件大小（仅文件类型）
  mimeType?: string; // MIME类型（仅文件类型）
}

// 设备类型
export interface Device {
  deviceId: string;
  deviceName: string;
  userAgent?: string;
  isConnected: boolean;
  lastSync: string;
  createdAt: string;
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
}

// 上传请求类型
export interface UploadRequest {
  type: 'text' | 'image' | 'file';
  content: string;
  deviceId: string;
  fileName?: string; // 文件名（仅文件类型）
  fileSize?: number; // 文件大小（仅文件类型）
  mimeType?: string; // MIME类型（仅文件类型）
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: 'sync' | 'delete' | 'get_all_text' | 'get_all_images' | 'get_latest' | 'all_text' | 'all_images' | 'latest' | 'error' | 'pong' | 'ping' | 'new_item' | 'delete_item';
  data?: ClipboardItem | ClipboardItem[] | string | number | Record<string, unknown>;
  id?: string;
  count?: number;
  message?: string;
  deviceId?: string;
}

// 应用配置文件结构
export interface AppConfig {
  database: DatabaseConfig;
  websocket: WebSocketConfig;
  cleanup: CleanupConfig;
}

// MySQL数据库连接配置
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  charset: string;
}

// WebSocket配置
export interface WebSocketConfig {
  port: number; // WebSocket服务端口
  heartbeatInterval: number; // 心跳检测间隔（毫秒）
  reconnectInterval: number; // 重连间隔（毫秒）
  maxReconnectAttempts: number; // 最大重连次数
}

// 清理策略配置
export interface CleanupConfig {
  enabled: boolean; // 是否启用自动清理
  strategy: 'count' | 'date' | 'both'; // 清理策略
  maxCount?: number; // 最大保留数量
  beforeDate?: string; // 清理指定日期之前的内容
  autoCleanInterval?: number; // 自动清理间隔（小时）
}

// 清理请求类型
export interface CleanupRequest {
  type?: 'count' | 'date';
  value?: number | string;
}

// 分页查询参数
export interface PaginationParams {
  page?: number;
  limit?: number;
  type?: 'text' | 'image' | 'file';
  search?: string;
  filter?: 'all_text' | 'all_images' | 'latest';
}

// 分页响应类型
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}