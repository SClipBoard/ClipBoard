# 剪切板同步服务

一个跨设备的剪切板同步服务，支持文字和图片内容的实时同步。

## 功能特性

### 核心功能
- 📋 **剪切板同步**: 支持文字和图片内容的跨设备同步
- 🔄 **实时更新**: 基于WebSocket的实时内容推送
- 📱 **多设备支持**: 支持多个设备同时连接和同步
- 🔍 **内容搜索**: 支持按内容、类型、设备筛选和搜索
- 📊 **数据统计**: 提供存储使用情况和同步统计

### 管理功能
- 🗂️ **批量操作**: 支持批量选择、删除剪切板内容
- 📤 **导入导出**: 支持JSON格式的数据导入导出
- ⚙️ **配置管理**: 灵活的同步和清理策略配置
- 🧹 **自动清理**: 可配置的过期内容自动清理
- 📈 **实时监控**: 设备连接状态和同步状态监控

## 技术架构

### 前端技术栈
- **React 18** - 用户界面框架
- **TypeScript** - 类型安全的JavaScript
- **Vite** - 快速的构建工具
- **Tailwind CSS** - 实用优先的CSS框架
- **React Router** - 客户端路由
- **Zustand** - 轻量级状态管理
- **Lucide React** - 图标库
- **Sonner** - 优雅的通知组件

### 后端技术栈
- **Node.js** - JavaScript运行时
- **Express.js** - Web应用框架
- **TypeScript** - 类型安全的JavaScript
- **WebSocket (ws)** - 实时通信
- **MySQL** - 关系型数据库
- **Multer** - 文件上传中间件
- **CORS** - 跨域资源共享

## 项目结构

```
clipboard-sync/
├── src/                    # 前端源码
│   ├── components/         # React组件
│   ├── pages/             # 页面组件
│   ├── hooks/             # 自定义Hooks
│   ├── lib/               # 工具库
│   └── assets/            # 静态资源
├── api/                   # 后端源码
│   ├── routes/            # API路由
│   ├── config/            # 配置管理
│   ├── utils/             # 工具函数
│   ├── database.ts        # 数据库操作
│   ├── websocket.ts       # WebSocket服务
│   ├── app.ts             # Express应用
│   └── server.ts          # 服务器入口
├── shared/                # 共享类型定义
├── migrations/            # 数据库迁移文件
├── uploads/               # 文件上传目录
└── logs/                  # 日志文件
```

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- MySQL >= 8.0
- npm >= 8.0.0

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/yourusername/clipboard-sync.git
cd clipboard-sync
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库连接等信息：
```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=clipboard_sync

# 服务器配置
PORT=3001
NODE_ENV=development

# WebSocket配置
WS_PORT=3002
```

4. **初始化数据库**

在MySQL中创建数据库：
```sql
CREATE DATABASE clipboard_sync CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

执行初始化脚本：
```bash
mysql -u root -p clipboard_sync < migrations/001_init_database.sql
```

5. **启动开发服务器**
```bash
npm run dev
```

这将同时启动前端开发服务器（http://localhost:5173）和后端API服务器（http://localhost:3001）。

### 生产部署

1. **构建项目**
```bash
npm run build
```

2. **启动生产服务器**
```bash
npm start
```

## 使用指南

### 主要页面

1. **主页面** (`/`)
   - 查看所有剪切板内容
   - 搜索和筛选内容
   - 一键复制到剪切板
   - 查看设备连接状态

2. **上传页面** (`/upload`)
   - 上传文字内容
   - 上传图片文件
   - 支持拖拽上传
   - 支持剪切板粘贴

3. **设置页面** (`/settings`)
   - 设备管理
   - 同步配置
   - 清理策略
   - 存储统计

4. **管理页面** (`/manage`)
   - 批量操作
   - 导入导出
   - 内容分类
   - 高级筛选

### API接口

#### 剪切板接口
- `GET /api/clipboard` - 获取剪切板内容列表
- `POST /api/clipboard` - 创建新的剪切板内容
- `DELETE /api/clipboard/:id` - 删除指定内容

#### 设备接口
- `GET /api/devices` - 获取设备列表
- `POST /api/devices` - 注册新设备
- `PUT /api/devices/:id` - 更新设备信息

#### 配置接口
- `GET /api/config` - 获取配置信息
- `PUT /api/config` - 更新配置
- `POST /api/config/cleanup` - 执行清理操作

### WebSocket事件

#### 客户端发送
- `sync` - 请求同步
- `get_text` - 获取文字内容
- `get_image` - 获取图片内容
- `get_latest` - 获取最新内容
- `ping` - 心跳检测

#### 服务器推送
- `new_item` - 新内容通知
- `item_deleted` - 内容删除通知
- `sync_response` - 同步响应
- `pong` - 心跳响应

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_HOST` | 数据库主机 | localhost |
| `DB_PORT` | 数据库端口 | 3306 |
| `DB_USER` | 数据库用户名 | root |
| `DB_PASSWORD` | 数据库密码 | - |
| `DB_NAME` | 数据库名称 | clipboard_sync |
| `PORT` | 服务器端口 | 3001 |
| `WS_PORT` | WebSocket端口 | 3002 |
| `MAX_FILE_SIZE` | 最大文件大小 | 10485760 (10MB) |
| `AUTO_CLEANUP_ENABLED` | 自动清理开关 | true |
| `AUTO_CLEANUP_DAYS` | 自动清理天数 | 30 |
| `MAX_ITEMS_PER_DEVICE` | 每设备最大条目数 | 1000 |

### 数据库配置

项目使用MySQL数据库，主要表结构：

- `clipboard_items` - 剪切板内容表
- `devices` - 设备信息表

详细的表结构请参考 `migrations/001_init_database.sql` 文件。

## 开发指南

### 代码规范

- 使用TypeScript进行类型检查
- 遵循ESLint规则
- 使用Prettier格式化代码
- 组件文件使用PascalCase命名
- 工具函数使用camelCase命名

### 开发命令

```bash
# 启动开发服务器
npm run dev

# 仅启动前端
npm run dev:frontend

# 仅启动后端
npm run dev:backend

# 类型检查
npm run type-check

# 代码检查
npm run lint

# 修复代码格式
npm run lint:fix

# 构建项目
npm run build

# 清理构建文件
npm run clean
```

### 添加新功能

1. **前端组件**
   - 在 `src/components/` 目录下创建新组件
   - 使用TypeScript和Tailwind CSS
   - 遵循现有的代码风格

2. **后端API**
   - 在 `api/routes/` 目录下创建新路由
   - 使用Express Router
   - 添加适当的错误处理

3. **数据库变更**
   - 在 `migrations/` 目录下创建新的迁移文件
   - 使用时间戳命名：`YYYYMMDD_HHMMSS_description.sql`

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查MySQL服务是否启动
   - 验证数据库配置信息
   - 确认数据库用户权限

2. **WebSocket连接失败**
   - 检查端口是否被占用
   - 验证防火墙设置
   - 确认CORS配置

3. **文件上传失败**
   - 检查上传目录权限
   - 验证文件大小限制
   - 确认磁盘空间

### 日志查看

应用日志保存在 `logs/app.log` 文件中，可以通过以下方式查看：

```bash
# 查看最新日志
tail -f logs/app.log

# 搜索错误日志
grep "ERROR" logs/app.log
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证。详情请参阅 [LICENSE](LICENSE) 文件。

## 联系方式

- 项目主页: https://github.com/yourusername/clipboard-sync
- 问题反馈: https://github.com/yourusername/clipboard-sync/issues
- 邮箱: your.email@example.com

## 更新日志

### v1.0.0 (2024-01-XX)
- 🎉 初始版本发布
- ✨ 支持文字和图片同步
- ✨ 实时WebSocket通信
- ✨ 多设备管理
- ✨ 批量操作功能
- ✨ 导入导出功能
- ✨ 自动清理策略
- ✨ 完整的配置管理

---

感谢使用剪切板同步服务！如果您觉得这个项目有用，请给我们一个 ⭐️！