# WebSocket 实时监控使用指南

## 概述

本项目的WebSocket接口支持真正的实时通信，当剪切板内容发生变化时，服务器会主动推送消息给所有连接的客户端，无需客户端轮询。

## 快速开始

### 1. 使用Python监控脚本

```bash
# 安装依赖
pip install websockets

# 启动实时监控
python ws_monitor.py

# 指定设备ID
python ws_monitor.py --device-id my-device

# 指定服务器地址
python ws_monitor.py --url ws://localhost:3002/ws
```

### 2. 连接地址

```
ws://localhost:3002/ws?deviceId=your-device-id
```

## 实时推送机制

### 服务器主动推送的消息类型

1. **新内容推送** (`sync`)
   - 当有新的剪切板内容时，服务器会推送给所有连接的客户端
   - 消息格式：
   ```json
   {
     "type": "sync",
     "data": {
       "id": "uuid",
       "type": "text|image|file",
       "content": "内容",
       "deviceId": "设备ID",
       "createdAt": "2024-01-01T00:00:00.000Z"
     }
   }
   ```

2. **删除通知** (`delete`)
   - 当剪切板内容被删除时推送
   - 消息格式：
   ```json
   {
     "type": "delete",
     "id": "被删除的项目ID"
   }
   ```

3. **连接统计更新** (`connection_stats`)
   - 当连接数发生变化时推送
   - 消息格式：
   ```json
   {
     "type": "connection_stats",
     "data": {
       "totalConnections": 5,
       "activeConnections": 3,
       "connectedDevices": [...]
     }
   }
   ```

### 客户端主动请求的消息类型

1. **获取所有内容** (`get_all_content`)
   ```json
   {
     "type": "get_all_content",
     "data": {
       "limit": 100,
       "type": "text",
       "search": "关键词"
     }
   }
   ```

2. **获取最新内容** (`get_latest`)
   ```json
   {
     "type": "get_latest",
     "count": 10
   }
   ```

## 实际使用场景

### 场景1：实时监控剪切板变化

```python
# 启动监控脚本，实时查看剪切板变化
python ws_monitor.py --device-id monitor-001
```

当其他设备或应用向剪切板添加内容时，监控脚本会立即显示新内容。

### 场景2：多设备同步

1. 设备A连接：`ws://localhost:3002/ws?deviceId=device-A`
2. 设备B连接：`ws://localhost:3002/ws?deviceId=device-B`
3. 设备A添加内容 → 设备B立即收到推送
4. 设备B删除内容 → 设备A立即收到删除通知

### 场景3：Web应用集成

```javascript
class ClipboardSync {
  constructor(deviceId) {
    this.ws = new WebSocket(`ws://localhost:3002/ws?deviceId=${deviceId}`);
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'sync':
          if (message.data.type) {
            this.onNewContent(message.data);
          }
          break;
        case 'delete':
          this.onContentDeleted(message.id);
          break;
      }
    };
  }
  
  onNewContent(item) {
    console.log('新内容:', item);
    // 更新UI
  }
  
  onContentDeleted(itemId) {
    console.log('内容已删除:', itemId);
    // 更新UI
  }
}

// 使用
const sync = new ClipboardSync('web-client-001');
```

## 优势

1. **真正实时** - 无延迟推送，不依赖轮询
2. **高效** - 只在有变化时才推送消息
3. **双向通信** - 客户端可以主动请求，服务器可以主动推送
4. **多设备支持** - 支持多个设备同时连接和同步
5. **类型丰富** - 支持文本、图片、文件等多种内容类型

## 注意事项

1. **连接保持** - WebSocket连接需要保持活跃，服务器有心跳检测机制
2. **错误处理** - 客户端应该处理连接断开和重连逻辑
3. **消息格式** - 所有消息都是JSON格式，需要正确解析
4. **设备ID** - 建议为每个客户端设置唯一的设备ID

## 测试建议

1. 先使用提供的Python监控脚本测试连接
2. 在另一个终端或浏览器中调用REST API添加内容
3. 观察监控脚本是否实时收到推送消息
4. 测试多个客户端同时连接的情况

这样就实现了真正的实时剪切板同步，而不是传统的轮询方式！
