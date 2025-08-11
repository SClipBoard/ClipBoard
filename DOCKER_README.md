# Docker 部署指南

## 🐳 环境检测机制

应用会自动检测运行环境：

### 容器化环境（使用环境变量）
- Docker 容器
- Kubernetes 集群
- 其他容器化平台

### 本地开发环境（使用 .env 文件）
- 本地开发
- 传统服务器部署

## 🚀 Docker 部署

### 1. 使用 Docker Compose（推荐）

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 停止服务
docker-compose down
```

### 2. 单独构建和运行

```bash
# 构建镜像
docker build -t clipboard-sync .

# 运行容器（需要手动配置所有环境变量）
docker run -d \
  --name clipboard-sync \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e DOCKER_ENV=true \
  -e DB_HOST=your-db-host \
  -e DB_PORT=3306 \
  -e DB_USER=your-db-user \
  -e DB_PASSWORD=your-db-password \
  -e DB_NAME=clipboard_sync \
  -e CORS_ORIGIN=* \
  -e JWT_SECRET=your-super-secret-jwt-key \
  clipboard-sync
```

## 📋 环境变量配置

### 必需的环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `DB_HOST` | 数据库主机地址 | - |
| `DB_USER` | 数据库用户名 | - |
| `DB_PASSWORD` | 数据库密码 | - |
| `DB_NAME` | 数据库名称 | - |

### 可选的环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `PORT` | HTTP 服务端口 | `3001` |
| `WS_PORT` | WebSocket 端口 | `3002` |
| `CORS_ORIGIN` | CORS 允许的源 | `*` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `LOG_FILE` | 日志文件路径 | `logs/app.log` |
| `UPLOAD_DIR` | 上传目录 | `uploads` |
| `MAX_FILE_SIZE` | 最大文件大小（字节） | `10485760` |
| `JWT_SECRET` | JWT 密钥 | 自动生成 |
| `AUTO_CLEANUP_ENABLED` | 自动清理开关 | `true` |
| `AUTO_CLEANUP_DAYS` | 自动清理天数 | `30` |
| `MAX_ITEMS_PER_DEVICE` | 每设备最大条目数 | `1000` |

## 🔧 本地开发

在本地开发时，应用会自动创建 `.env` 文件：

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

首次运行时会自动创建 `.env` 文件，请根据提示修改数据库配置。

## 🛠️ 故障排除

### 1. 应用无法连接数据库
- 检查数据库环境变量是否正确设置
- 确保数据库服务已启动
- 检查网络连接

### 2. 环境变量未生效
- 确认是否在容器化环境中运行
- 检查环境变量拼写是否正确
- 重启容器服务

### 3. 文件上传失败
- 检查 `uploads` 目录权限
- 确认 `MAX_FILE_SIZE` 设置合理

## 📝 注意事项

1. **生产环境安全**：请务必修改默认的 `JWT_SECRET`
2. **数据持久化**：使用 Docker Volumes 确保数据不丢失
3. **日志管理**：定期清理日志文件避免磁盘空间不足
4. **备份策略**：定期备份数据库和上传文件
