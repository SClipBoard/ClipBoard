import type { WebSocketMessage, ClipboardItem, ConnectionStats } from '../../shared/types';
import { getWebSocketPort, fetchServerConfig } from './config';

type WebSocketEventHandler = {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onNewItem?: (item: ClipboardItem) => void;
  onDeleteItem?: (itemId: string) => void;
  onSync?: (items: ClipboardItem[]) => void;
  onConnectionStats?: (stats: ConnectionStats) => void;
  onError?: (error: string) => void;
};

/**
 * WebSocket连接管理类
 */
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: WebSocketEventHandler = {};
  private isConnecting = false;
  private deviceId: string;
  private autoConnect = true;
  private initialConnectDelay = 100; // 初始连接延迟
  private wsPort: number | null = null; // 动态获取的WebSocket端口

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    // 延迟自动连接，确保页面完全加载
    setTimeout(async () => {
      if (this.autoConnect) {
        await this.connect();
      }
    }, this.initialConnectDelay);
  }

  /**
   * 设置事件处理器
   */
  setHandlers(handlers: WebSocketEventHandler): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * 获取WebSocket配置
   */
  private async fetchWebSocketConfig(): Promise<number> {
    try {
      const serverConfig = await fetchServerConfig();
      if (serverConfig?.websocket?.port) {
        return serverConfig.websocket.port;
      }
    } catch (error) {
      console.warn('获取WebSocket配置失败，使用默认配置:', error);
    }

    // 如果获取配置失败，使用环境变量或默认值
    return getWebSocketPort();
  }

  /**
   * 生成WebSocket连接URL
   */
  private async generateWebSocketUrl(): Promise<string> {
    // 获取当前页面的协议和主机名
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;

    // 动态获取WebSocket端口配置
    if (this.wsPort === null) {
      this.wsPort = await this.fetchWebSocketConfig();
    }

    // 构建WebSocket URL
    const wsUrl = `${protocol}//${hostname}:${this.wsPort}`;

    return `${wsUrl}?deviceId=${this.deviceId}`;
  }

  /**
   * 连接WebSocket服务器
   */
  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket已连接或正在连接中，跳过重复连接');
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = await this.generateWebSocketUrl();
      console.log(`尝试连接WebSocket服务器: ${wsUrl}`);

      this.createWebSocketConnection(wsUrl);
    } catch (error) {
      console.error('生成WebSocket URL失败:', error);
      this.isConnecting = false;
      this.handlers.onError?.('无法生成WebSocket连接地址');

      // 生成URL失败也尝试重连
      if (this.autoConnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * 创建WebSocket连接
   */
  private createWebSocketConnection(wsUrl: string): void {
    try {
      this.ws = new WebSocket(wsUrl);

      // 设置连接超时
      const connectTimeout = setTimeout(() => {
        if (this.isConnecting) {
          console.error('WebSocket连接超时');
          this.isConnecting = false;
          if (this.ws) {
            this.ws.close();
          }
          this.handlers.onError?.('连接超时，请检查网络连接');

          // 连接超时也尝试重连
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        }
      }, 10000); // 10秒超时
      
      this.ws.onopen = () => {
        console.log('WebSocket连接已建立');
        clearTimeout(connectTimeout);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.handlers.onConnect?.();
        
        // 发送心跳
        this.startHeartbeat();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket连接已关闭:', event.code, event.reason);
        this.isConnecting = false;
        this.ws = null;
        this.handlers.onDisconnect?.();
        
        // 根据关闭代码判断是否需要重连
        const shouldReconnect = this.shouldReconnect(event.code);
        
        if (shouldReconnect && this.autoConnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`连接关闭代码: ${event.code}, 将尝试重连`);
          this.scheduleReconnect();
        } else if (!shouldReconnect) {
          console.log(`连接关闭代码: ${event.code}, 不进行重连`);
          this.handlers.onError?.('连接已被服务器拒绝或终止');
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log('已达到最大重连次数，停止重连');
          this.handlers.onError?.('连接失败，已达到最大重连次数');
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this.isConnecting = false;
        
        // 提供更详细的错误信息
        let errorMessage = 'WebSocket连接错误';
        if (this.reconnectAttempts === 0) {
          errorMessage = '无法连接到服务器，请检查网络连接';
        } else {
          errorMessage = `连接错误，正在尝试第${this.reconnectAttempts + 1}次重连`;
        }
        
        this.handlers.onError?.(errorMessage);
        
        // 在错误时也尝试重连
        if (this.autoConnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
      
    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      this.isConnecting = false;
      this.handlers.onError?.('无法创建WebSocket连接');
    }
  }

  /**
   * 断开WebSocket连接
   */
  disconnect(): void {
    this.autoConnect = false; // 禁用自动连接
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, '主动断开连接');
      this.ws = null;
    }
    
    this.reconnectAttempts = this.maxReconnectAttempts; // 阻止自动重连
  }

  /**
   * 手动重连
   */
  async reconnect(): Promise<void> {
    console.log('手动重连WebSocket...');
    this.autoConnect = true; // 重新启用自动连接
    this.reconnectAttempts = 0; // 重置重连次数
    this.wsPort = null; // 重置端口，重新获取配置

    // 先断开现有连接
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 立即尝试连接
    await this.connect();
  }

  /**
   * 发送消息
   */
  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  }

  /**
   * 请求同步
   */
  requestSync(): void {
    this.send({
      type: 'sync',
      deviceId: this.deviceId
    });
  }

  /**
   * 获取文本内容
   */
  getTextItems(): void {
    this.send({
      type: 'get_all_text',
      deviceId: this.deviceId
    });
  }

  /**
   * 获取图片内容
   */
  getImageItems(): void {
    this.send({
      type: 'get_all_images',
      deviceId: this.deviceId
    });
  }

  /**
   * 获取最新内容
   */
  getLatestItems(count: number = 10): void {
    this.send({
      type: 'get_latest',
      deviceId: this.deviceId,
      data: { count }
    });
  }

  /**
   * 获取连接状态
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'sync':
        // 处理同步消息，可能是单个新项目或所有项目列表
        if (message.data) {
          if (Array.isArray(message.data)) {
            // 同步所有项目
            this.handlers.onSync?.(message.data as ClipboardItem[]);
          } else if (typeof message.data === 'object' && 'type' in message.data) {
            // 新的单个项目
            this.handlers.onNewItem?.(message.data as ClipboardItem);
          }
        }
        break;
        
      case 'delete':
        if (message.id) {
          this.handlers.onDeleteItem?.(message.id);
        }
        break;
        
      case 'all_text':
      case 'all_images':
      case 'latest':
        if (message.data && Array.isArray(message.data)) {
          this.handlers.onSync?.(message.data as ClipboardItem[]);
        }
        break;
        
      case 'error':
        if (message.data && typeof message.data === 'object' && 'message' in message.data) {
          this.handlers.onError?.(message.data.message as string);
        }
        break;
        
      case 'connection_stats':
        if (message.data && typeof message.data === 'object') {
          this.handlers.onConnectionStats?.(message.data as ConnectionStats);
        }
        break;

      case 'pong':
        // 心跳响应，无需处理
        break;

      default:
        console.warn('未知的WebSocket消息类型:', message.type);
    }
  }

  /**
   * 判断是否应该重连
   */
  private shouldReconnect(closeCode: number): boolean {
    // 根据WebSocket关闭代码判断是否应该重连
    switch (closeCode) {
      case 1000: // 正常关闭
      case 1001: // 端点离开
        return false;
      case 1006: // 异常关闭（网络问题）
      case 1011: // 服务器错误
      case 1012: // 服务重启
      case 1013: // 服务过载
        return true;
      default:
        // 其他情况默认尝试重连
        return true;
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    // 如果已经禁用自动连接，则不进行重连
    if (!this.autoConnect) {
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000); // 最大延迟30秒
    
    console.log(`${delay}ms后尝试第${this.reconnectAttempts}次重连...`);
    
    this.reconnectTimer = setTimeout(async () => {
      if (this.autoConnect && this.reconnectAttempts <= this.maxReconnectAttempts) {
        await this.connect();
      }
    }, delay);
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    const heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          deviceId: this.deviceId
        });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // 每30秒发送一次心跳
  }
}

// 生成设备ID
function generateDeviceId(): string {
  const stored = localStorage.getItem('clipboard_device_id');
  if (stored) {
    return stored;
  }
  
  const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  localStorage.setItem('clipboard_device_id', deviceId);
  return deviceId;
}

// 导出单例实例
export const deviceId = generateDeviceId();
export const wsManager = new WebSocketManager(deviceId);
export default wsManager;