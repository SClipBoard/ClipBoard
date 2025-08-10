export interface ClipboardItem {
    id: string;
    type: 'text' | 'image' | 'file';
    content: string;
    deviceId: string;
    createdAt: string;
    updatedAt: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    total?: number;
}
export interface UploadRequest {
    type: 'text' | 'image' | 'file';
    content: string;
    deviceId: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
}
export interface WebSocketMessage {
    type: 'sync' | 'delete' | 'get_all_text' | 'get_all_images' | 'get_latest' | 'all_text' | 'all_images' | 'latest' | 'error' | 'pong' | 'ping' | 'new_item' | 'delete_item';
    data?: ClipboardItem | ClipboardItem[] | string | number | Record<string, unknown>;
    id?: string;
    count?: number;
    message?: string;
    deviceId?: string;
}
export interface AppConfig {
    database: DatabaseConfig;
    websocket: WebSocketConfig;
    cleanup: CleanupConfig;
}
export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    charset: string;
}
export interface WebSocketConfig {
    port: number;
    heartbeatInterval: number;
    reconnectInterval: number;
    maxReconnectAttempts: number;
}
export interface CleanupConfig {
    enabled: boolean;
    strategy: 'count' | 'date' | 'both';
    maxCount?: number;
    beforeDate?: string;
    autoCleanInterval?: number;
}
export interface CleanupRequest {
    type?: 'count' | 'date';
    value?: number | string;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    type?: 'text' | 'image' | 'file';
    search?: string;
    filter?: 'all_text' | 'all_images' | 'latest';
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
