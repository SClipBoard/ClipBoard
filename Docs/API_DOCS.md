# 剪切板同步服务 API 文档

## 概述

本项目已集成 Swagger/OpenAPI 3.0 规范的 API 文档，提供完整的接口说明和在线测试功能。

## 访问方式

### 在线文档界面
启动服务后，访问以下地址查看交互式 API 文档：

```
http://localhost:3001/api/docs
```

### JSON 规范文件
获取完整的 OpenAPI JSON 规范：

```
http://localhost:3001/api/docs.json
```

## 功能特性

### 📚 完整的接口文档
- **健康检查接口** - 服务器状态检查
- **剪切板管理接口** - 内容的增删改查
- **设备管理接口** - WebSocket 连接统计
- **配置管理接口** - 系统配置和数据清理
- **WebSocket 实时接口** - 实时获取和同步剪切板内容

### 🎯 交互式测试
- 在线测试所有 API 接口
- 实时查看请求和响应
- 支持参数验证和错误提示
- 自动生成请求示例

### 📋 详细的数据模型
- 完整的请求/响应数据结构
- 参数类型和验证规则
- 错误码和错误信息说明
- 示例数据展示

## API 接口概览

### 健康检查
- `GET /api/health` - 服务器健康检查

### 剪切板管理
- `GET /api/clipboard` - 获取剪切板内容列表（支持分页、筛选、搜索）
- `POST /api/clipboard` - 上传新的剪切板内容
- `GET /api/clipboard/{id}` - 获取单个剪切板内容详情
- `DELETE /api/clipboard/{id}` - 删除指定剪切板内容

### 设备管理
- `GET /api/devices/connections` - 获取 WebSocket 连接统计

### 配置管理
- `GET /api/config/client` - 获取客户端配置
- `GET /api/config` - 获取用户配置
- `PUT /api/config` - 更新用户配置
- `POST /api/config/cleanup` - 清理过期内容
- `DELETE /api/config/clear-all` - 清空所有内容
- `GET /api/config/stats` - 获取存储统计信息

### WebSocket 实时接口
- `WebSocket /ws` - 建立WebSocket连接进行实时通信
  - **实时推送**: 服务器主动推送新增/删除的剪切板内容
  - **获取所有内容**: `get_all_content` - 主动获取所有剪切板内容
  - **获取文本内容**: `get_all_text` - 获取所有文本类型内容
  - **获取图片内容**: `get_all_images` - 获取所有图片类型内容
  - **获取最新内容**: `get_latest` - 获取最新的N条内容
  - **同步内容**: `sync` - 同步新的剪切板内容
  - **删除内容**: `delete` - 删除指定内容

## 数据模型

### ClipboardItem（剪切板项）
```json
{
  "id": "string",
  "type": "text|image|file",
  "content": "string",
  "deviceId": "string",
  "fileName": "string",
  "fileSize": "number",
  "mimeType": "string",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### ApiResponse（通用响应）
```json
{
  "success": "boolean",
  "message": "string",
  "data": "any",
  "total": "number"
}
```

## 使用说明

1. **启动服务**
   ```bash
   npm run dev
   ```

2. **访问文档**
   打开浏览器访问 `http://localhost:3001/api/docs`

3. **测试接口**
   - 点击任意接口展开详情
   - 点击 "Try it out" 按钮
   - 填写必要参数
   - 点击 "Execute" 执行请求
   - 查看响应结果

4. **WebSocket 实时监控测试**

   使用Python脚本进行实时监控：
   ```bash
   # 安装依赖
   pip install websockets

   # 启动实时监控
   python ws_monitor.py

   # 指定设备ID
   python ws_monitor.py --device-id my-device
   ```

   或使用JavaScript：
   ```javascript
   // 建立WebSocket连接
   const ws = new WebSocket('ws://localhost:3002/ws?deviceId=test-device');

   ws.onopen = () => {
     console.log('WebSocket连接已建立，开始实时监听...');
   };

   ws.onmessage = (event) => {
     const message = JSON.parse(event.data);

     if (message.type === 'sync' && message.data.type) {
       console.log('🆕 新内容推送:', message.data);
     } else if (message.type === 'delete') {
       console.log('🗑️ 内容已删除:', message.id);
     }
   };
   ```

## 技术实现

- **Swagger UI Express** - 提供交互式文档界面
- **Swagger JSDoc** - 从代码注释生成 OpenAPI 规范
- **OpenAPI 3.0** - 标准的 API 规范格式
- **TypeScript** - 类型安全的接口定义

## 自定义配置

文档配置位于 `api/swagger.ts` 文件中，可以自定义：
- API 信息（标题、版本、描述）
- 服务器地址
- 数据模型定义
- 文档样式

## 注意事项

- 确保服务器正常运行后再访问文档
- 文档会自动同步代码中的接口变更
- 支持导出 OpenAPI JSON 规范用于其他工具

---

更多详细信息请查看在线文档界面。
