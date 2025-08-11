# 配置说明

## 概述

本项目支持灵活的配置系统，可以在开发环境和生产环境中动态配置API和WebSocket连接。

## 环境变量配置

### 后端配置

在 `.env` 文件中配置以下变量：

```env
# 服务器配置
PORT=3001                    # API服务器端口
NODE_ENV=development         # 运行环境
WS_PORT=3002                # WebSocket服务器端口

# 前端配置
VITE_API_PORT=3001          # 前端连接的API端口
VITE_WS_PORT=3002           # 前端连接的WebSocket端口

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=clipboard_sync

# 其他配置
CORS_ORIGIN=*               # CORS允许的源
MAX_FILE_SIZE=10485760      # 最大文件大小（字节）
UPLOAD_DIR=uploads          # 文件上传目录
```

### 容器化部署

在容器化环境中，可以通过环境变量直接配置：

```bash
docker run -e PORT=3001 -e WS_PORT=3002 -e VITE_API_PORT=3001 -e VITE_WS_PORT=3002 ...
```

## 前端配置系统

### 动态URL配置

前端会根据运行环境自动选择合适的API和WebSocket连接方式：

#### 开发环境
- API请求：通过Vite代理转发到 `/api`
- WebSocket连接：使用 `ws://localhost:${VITE_WS_PORT}`

#### 生产环境
- API请求：使用当前域名和配置的端口 `${protocol}//${hostname}:${VITE_API_PORT}/api`
- WebSocket连接：使用当前域名和配置的端口 `${protocol}//${hostname}:${VITE_WS_PORT}`

### 配置API

前端可以通过 `/api/config/client` 端点获取服务器配置：

```typescript
// 获取服务器配置
const response = await fetch('/api/config/client');
const config = await response.json();
// config.data.websocket.port 包含WebSocket端口
```

### 使用配置工具

```typescript
import { getApiBaseUrl, getWebSocketPort, getClientConfig } from '@/lib/config';

// 获取API基础URL
const apiUrl = getApiBaseUrl();

// 获取WebSocket端口
const wsPort = getWebSocketPort();

// 获取完整配置
const config = getClientConfig();
```

## 部署场景

### 1. 本地开发

```bash
# 启动开发服务器
npm run dev
```

前端会自动使用Vite代理，无需额外配置。

### 2. 生产环境部署

#### 同端口部署（推荐）
将前端构建文件与后端服务部署在同一端口：

```bash
# 构建前端
npm run build

# 启动后端服务（会自动服务前端文件）
npm start
```

#### 分离部署
前端和后端分别部署在不同端口：

```env
# 后端 .env
PORT=3001
WS_PORT=3002

# 前端构建时的环境变量
VITE_API_PORT=3001
VITE_WS_PORT=3002
```

### 3. 容器化部署

使用Docker Compose：

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
      - "3002:3002"
    environment:
      - PORT=3001
      - WS_PORT=3002
      - VITE_API_PORT=3001
      - VITE_WS_PORT=3002
      - DB_HOST=db
      - DB_USER=root
      - DB_PASSWORD=password
      - DB_NAME=clipboard_sync
```

### 4. 反向代理部署

使用Nginx等反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        proxy_pass http://localhost:3001;
    }

    # API请求
    location /api {
        proxy_pass http://localhost:3001;
    }

    # WebSocket连接
    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 故障排除

### 1. 连接错误

如果出现连接错误，检查：
- 环境变量是否正确设置
- 端口是否被占用
- 防火墙是否阻止连接

### 2. 配置不生效

确保：
- 重启服务器后配置才会生效
- 前端需要重新构建才能应用新的环境变量
- 容器化部署时环境变量正确传递

### 3. WebSocket连接失败

检查：
- WebSocket端口是否正确配置
- 是否有代理服务器阻止WebSocket连接
- 浏览器是否支持WebSocket

## 最佳实践

1. **开发环境**：使用默认配置，通过 `.env` 文件管理
2. **生产环境**：通过环境变量或配置文件管理
3. **容器化**：使用环境变量传递配置
4. **安全性**：不要在前端代码中硬编码敏感信息
5. **监控**：定期检查配置是否正确应用
