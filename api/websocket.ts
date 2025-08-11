import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import type { WebSocketMessage, ClipboardItem, ConnectionStats } from './types/shared';
import { ClipboardItemDAO } from './database.js';

// WebSocket连接管理
interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  deviceId?: string;
  lastPing: number;
}

class WebSocketManager {
  private wss: WebSocketServer;
  private connections: Map<string, WebSocketConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.setupWebSocketServer();
    this.startHeartbeat();
    
    console.log(`WebSocket服务器启动在端口 ${port}`);
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const connectionId = uuidv4();
      
      // 解析URL查询参数获取deviceId
      const url = new URL(req.url || '', 'http://localhost');
      const deviceId = url.searchParams.get('deviceId');
      
      const connection: WebSocketConnection = {
        id: connectionId,
        ws,
        deviceId: deviceId || undefined,
        lastPing: Date.now()
      };

      this.connections.set(connectionId, connection);
      console.log(`新的WebSocket连接: ${connectionId}, 设备ID: ${deviceId}`);

      // 发送连接成功消息
      this.sendMessage(ws, {
        type: 'sync',
        data: { message: '连接成功', connectionId }
      });

      // 广播连接统计更新
      this.broadcastConnectionStats();

      // 处理消息
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(connectionId, message);
        } catch (error) {
          console.error('解析WebSocket消息失败:', error);
          this.sendError(ws, '无效的消息格式');
        }
      });

      // 处理连接关闭
      ws.on('close', () => {
        console.log(`WebSocket连接关闭: ${connectionId}`);
        this.handleDisconnection(connectionId);
      });

      // 处理错误
      ws.on('error', (error) => {
        console.error(`WebSocket错误 ${connectionId}:`, error);
        this.handleDisconnection(connectionId);
      });

      // 处理pong响应
      ws.on('pong', () => {
        const conn = this.connections.get(connectionId);
        if (conn) {
          conn.lastPing = Date.now();
        }
      });
    });
  }

  private handleMessage(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    switch (message.type) {
      case 'sync':
        this.handleSync(connectionId, message).catch(error => {
          console.error('处理同步消息失败:', error);
          this.sendError(connection.ws, '处理同步消息失败');
        });
        break;
      case 'delete':
        this.handleDelete(connectionId, message);
        break;
      case 'get_all_text':
        this.handleGetAllText(connection.ws).catch(error => {
          console.error('处理获取文本消息失败:', error);
          this.sendError(connection.ws, '处理获取文本消息失败');
        });
        break;
      case 'get_all_images':
        this.handleGetAllImages(connection.ws).catch(error => {
          console.error('处理获取图片消息失败:', error);
          this.sendError(connection.ws, '处理获取图片消息失败');
        });
        break;
      case 'get_latest':
        this.handleGetLatest(connection.ws, message.count || 10).catch(error => {
          console.error('处理获取最新内容消息失败:', error);
          this.sendError(connection.ws, '处理获取最新内容消息失败');
        });
        break;
      case 'get_all_content':
        this.handleGetAllContent(connection.ws, message).catch(error => {
          console.error('处理获取所有内容消息失败:', error);
          this.sendError(connection.ws, '处理获取所有内容消息失败');
        });
        break;
      default:
        this.sendError(connection.ws, '未知的消息类型');
    }
  }

  private async handleSync(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // 更新连接的设备ID（如果提供）
    if (message.deviceId) {
      connection.deviceId = message.deviceId;
    }

    // 如果消息包含剪切板数据，广播给所有其他连接
    if (message.data && typeof message.data === 'object' && 'type' in message.data) {
      const clipboardData = message.data as ClipboardItem;
      if (clipboardData.type === 'text' || clipboardData.type === 'image') {
        this.broadcastToOthers(connectionId, message);
        return;
      }
    }

    // 如果是同步请求（没有数据），返回所有剪切板内容
    try {
      const result = await ClipboardItemDAO.getItems({ page: 1, limit: 1000 });
      this.sendMessage(connection.ws, {
        type: 'sync',
        data: result.items
      });
    } catch (error) {
      console.error('获取剪切板内容失败:', error);
      this.sendError(connection.ws, '获取剪切板内容失败');
    }
  }

  private handleDelete(connectionId: string, message: WebSocketMessage): void {
    if (message.id) {
      // 广播删除消息给所有其他连接
      this.broadcastToOthers(connectionId, message);
    }
  }

  private async handleGetAllText(ws: WebSocket): Promise<void> {
    try {
      const textItems = await ClipboardItemDAO.getByType('text');
      this.sendMessage(ws, {
        type: 'all_text',
        data: textItems
      });
    } catch (error) {
      console.error('获取文本内容失败:', error);
      this.sendError(ws, '获取文本内容失败');
    }
  }

  private async handleGetAllImages(ws: WebSocket): Promise<void> {
    try {
      const imageItems = await ClipboardItemDAO.getByType('image');
      this.sendMessage(ws, {
        type: 'all_images',
        data: imageItems
      });
    } catch (error) {
      console.error('获取图片内容失败:', error);
      this.sendError(ws, '获取图片内容失败');
    }
  }

  private async handleGetLatest(ws: WebSocket, count: number): Promise<void> {
    try {
      const latestItems = await ClipboardItemDAO.getLatest(count);
      this.sendMessage(ws, {
        type: 'latest',
        data: latestItems,
        count
      });
    } catch (error) {
      console.error('获取最新内容失败:', error);
      this.sendError(ws, '获取最新内容失败');
    }
  }

  private async handleGetAllContent(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    try {
      // 解析查询参数
      const queryParams = {
        page: 1,
        limit: 1000, // 默认获取1000条，可以通过消息参数调整
        type: undefined as 'text' | 'image' | 'file' | undefined,
        search: undefined as string | undefined,
        deviceId: undefined as string | undefined
      };

      // 如果消息中包含查询参数，使用这些参数
      if (message.data && typeof message.data === 'object') {
        const params = message.data as Record<string, unknown>;
        if (params.limit && typeof params.limit === 'number') {
          queryParams.limit = Math.min(params.limit, 5000); // 最大限制5000条
        }
        if (params.type && typeof params.type === 'string') {
          queryParams.type = params.type as 'text' | 'image' | 'file';
        }
        if (params.search && typeof params.search === 'string') {
          queryParams.search = params.search;
        }
        if (params.deviceId && typeof params.deviceId === 'string') {
          queryParams.deviceId = params.deviceId;
        }
      }

      // 获取所有剪切板内容
      const result = await ClipboardItemDAO.getItems(queryParams);

      this.sendMessage(ws, {
        type: 'all_content',
        data: result.items,
        message: `成功获取 ${result.items.length} 条剪切板内容`,
        count: result.total
      });

      console.log(`WebSocket客户端请求所有内容，返回 ${result.items.length} 条记录`);
    } catch (error) {
      console.error('获取所有剪切板内容失败:', error);
      this.sendError(ws, '获取所有剪切板内容失败');
    }
  }

  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection && connection.deviceId) {
      console.log(`设备 ${connection.deviceId} 断开连接`);
    }

    this.connections.delete(connectionId);

    // 广播连接统计更新
    this.broadcastConnectionStats();
  }

  private broadcastToOthers(senderConnectionId: string, message: WebSocketMessage): void {
    this.connections.forEach((connection, connectionId) => {
      if (connectionId !== senderConnectionId && connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connection.ws, message);
      }
    });
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('发送WebSocket消息失败:', error);
      }
    }
  }

  private sendError(ws: WebSocket, errorMessage: string): void {
    this.sendMessage(ws, {
      type: 'sync',
      data: { error: errorMessage }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60秒超时

      this.connections.forEach((connection, connectionId) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          // 检查是否超时
          if (now - connection.lastPing > timeout) {
            console.log(`连接超时，关闭连接: ${connectionId}`);
            connection.ws.terminate();
            this.handleDisconnection(connectionId);
          } else {
            // 发送ping
            connection.ws.ping();
          }
        } else {
          // 清理已关闭的连接
          this.handleDisconnection(connectionId);
        }
      });
    }, 30000); // 每30秒检查一次
  }

  // 广播新的剪切板内容给所有连接
  public broadcastNewItem(item: ClipboardItem): void {
    const message: WebSocketMessage = {
      type: 'sync',
      data: item
    };

    this.connections.forEach((connection) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connection.ws, message);
      }
    });
  }

  // 广播删除消息给所有连接
  public broadcastDeleteItem(itemId: string): void {
    const message: WebSocketMessage = {
      type: 'delete',
      id: itemId
    };

    this.connections.forEach((connection) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connection.ws, message);
      }
    });
  }

  // 广播连接统计给所有连接
  public broadcastConnectionStats(): void {
    const stats = this.getStats();
    const message: WebSocketMessage = {
      type: 'connection_stats',
      data: stats
    };

    this.connections.forEach((connection) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connection.ws, message);
      }
    });
  }

  // 广播所有剪切板内容给所有连接
  public async broadcastAllContent(): Promise<void> {
    try {
      const result = await ClipboardItemDAO.getItems({ page: 1, limit: 1000 });
      const message: WebSocketMessage = {
        type: 'all_content',
        data: result.items,
        message: `广播所有剪切板内容，共 ${result.items.length} 条`,
        count: result.total
      };

      this.connections.forEach((connection) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          this.sendMessage(connection.ws, message);
        }
      });

      console.log(`广播所有剪切板内容给 ${this.connections.size} 个连接，共 ${result.items.length} 条记录`);
    } catch (error) {
      console.error('广播所有剪切板内容失败:', error);
    }
  }

  // 获取连接统计
  public getStats(): {
    totalConnections: number;
    activeConnections: number;
    connectedDevices: Array<{ deviceId: string; connectionId: string }>;
  } {
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.ws.readyState === WebSocket.OPEN);

    const connectedDevices = activeConnections
      .filter(conn => conn.deviceId)
      .map(conn => ({
        deviceId: conn.deviceId!,
        connectionId: conn.id
      }));

    return {
      totalConnections: this.connections.size,
      activeConnections: activeConnections.length,
      connectedDevices
    };
  }

  // 关闭WebSocket服务器
  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.connections.forEach((connection) => {
      connection.ws.close();
    });
    
    this.wss.close();
    console.log('WebSocket服务器已关闭');
  }
}

export default WebSocketManager;
export type { WebSocketConnection };