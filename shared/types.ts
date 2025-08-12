// 剪切板内容项类型
export interface ClipboardItem {
  id: string;
  type: 'text' | 'image' | 'file';
  content: string; // 对于文本类型是内容，对于文件类型是文件路径
  deviceId: string;
  createdAt: string;
  updatedAt: string;
  fileName?: string; // 文件名（仅文件类型）
  fileSize?: number; // 文件大小（仅文件类型）
  mimeType?: string; // MIME类型（仅文件类型）
  filePath?: string; // 文件存储路径（仅文件类型）
}



// API响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
  filteredTotal?: number; // 筛选后的总数
  allTotal?: number; // 全部内容的总数
}

// 上传请求类型
export interface UploadRequest {
  type: 'text' | 'image' | 'file';
  content: string; // 对于文本类型是内容，对于文件类型可以是base64或文件路径
  deviceId: string;
  fileName?: string; // 文件名（仅文件类型）
  fileSize?: number; // 文件大小（仅文件类型）
  mimeType?: string; // MIME类型（仅文件类型）
}

// 文件上传请求类型（用于multipart/form-data）
export interface FileUploadRequest {
  type: 'file' | 'image';
  deviceId: string;
  fileName?: string; // 可选，如果不提供则使用上传文件的原始名称
}

// 更新请求类型
export interface UpdateRequest {
  content?: string; // 更新文本内容（仅限文本类型）
  fileName?: string; // 更新文件名（仅限文件和图片类型）
}

// 连接统计信息类型
export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  connectedDevices: Array<{ deviceId: string; connectionId: string }>;
}

// WebSocket消息类型
export interface WebSocketMessage {
  type: 'sync' | 'delete' | 'get_all_text' | 'get_all_images' | 'get_latest' | 'get_all_content' | 'all_text' | 'all_images' | 'latest' | 'all_content' | 'error' | 'pong' | 'ping' | 'new_item' | 'delete_item' | 'connection_stats';
  data?: ClipboardItem | ClipboardItem[] | ConnectionStats | string | number | Record<string, unknown>;
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
  fileCleanup?: FileCleanupConfig; // 文件清理配置
}

// 文件清理策略配置
export interface FileCleanupConfig {
  enabled: boolean; // 是否启用文件清理
  maxFileCount: number; // 最大文件数量
  strategy: 'oldest_first' | 'largest_first'; // 清理策略：最旧优先或最大优先
}

// 清理请求类型
export interface CleanupRequest {
  type?: 'count' | 'date' | 'file_count';
  value?: number | string;
  fileCleanupStrategy?: 'oldest_first' | 'largest_first';
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
  filteredTotal?: number; // 筛选后的总数
  allTotal?: number; // 全部内容的总数
  page: number;
  limit: number;
  totalPages: number;
}