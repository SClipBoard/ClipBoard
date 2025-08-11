# 文件存储升级说明

## 概述

本次升级将文件上传的存储方式从base64编码改为使用临时目录存储，并移除了文件大小和类型限制。

## 主要变更

### 1. 文件存储方式变更
- **之前**: 文件以base64编码存储在数据库的`content`字段中
- **现在**: 文件存储在`uploads/`目录中，数据库只存储文件路径

### 2. 数据库结构变更
- 添加了`file_path`字段用于存储文件路径
- 更新了`content`字段的注释，现在对于文件类型存储的是文件名而不是base64内容

### 3. 新增功能

#### 文件上传接口
- **新接口**: `POST /api/clipboard/upload` - 支持multipart/form-data文件上传
- **原接口**: `POST /api/clipboard` - 仍支持base64上传，会自动转换为文件存储

#### 文件下载接口
- `GET /api/files/{id}` - 下载文件
- `GET /api/files/{id}/preview` - 预览文件（内联显示）
- `GET /api/files/stats` - 获取文件存储统计信息

#### 文件清理功能
- `POST /api/files/cleanup` - 手动触发文件清理
- `GET /api/files/cleanup/status` - 获取清理任务状态
- 自动定期清理孤立文件（每24小时）

### 4. 文件管理改进

#### 自动文件清理
- 删除数据库记录时自动删除对应的物理文件
- 定期清理孤立文件（存在于文件系统但不在数据库中的文件）
- 清理缺失文件的数据库记录（数据库中存在但文件系统中不存在的记录）

#### 无限制上传
- 移除了文件大小限制
- 支持所有文件类型

## 使用方法

### 1. 通过multipart/form-data上传文件

```bash
curl -X POST http://localhost:3001/api/clipboard/upload \
  -F "file=@/path/to/your/file.pdf" \
  -F "type=file" \
  -F "deviceId=your-device-id"
```

### 2. 通过JSON上传base64文件（兼容原方式）

```bash
curl -X POST http://localhost:3001/api/clipboard \
  -H "Content-Type: application/json" \
  -d '{
    "type": "file",
    "content": "base64-encoded-content",
    "deviceId": "your-device-id",
    "fileName": "document.pdf",
    "mimeType": "application/pdf"
  }'
```

### 3. 下载文件

```bash
# 下载文件
curl -O http://localhost:3001/api/files/{clipboard-item-id}

# 预览文件
curl http://localhost:3001/api/files/{clipboard-item-id}/preview
```

### 4. 手动清理文件

```bash
curl -X POST http://localhost:3001/api/files/cleanup
```

## 数据库迁移

如果您有现有的数据库，请执行以下SQL脚本添加新字段：

```sql
-- 添加文件路径字段
ALTER TABLE clipboard_items 
ADD COLUMN IF NOT EXISTS file_path VARCHAR(500) NULL COMMENT '文件存储路径（仅文件类型）';

-- 更新content字段注释
ALTER TABLE clipboard_items 
MODIFY COLUMN content LONGTEXT NOT NULL COMMENT '内容数据（文字内容或文件路径）';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_clipboard_items_file_path ON clipboard_items(file_path);
```

或者直接执行迁移脚本：
```bash
mysql -u username -p database_name < migrations/add_file_path_field.sql
```

## 注意事项

### 1. 向后兼容性
- 现有的base64文件上传接口仍然可用
- 现有的数据库记录不会受到影响
- 客户端代码无需修改即可继续使用

### 2. 文件存储位置
- 文件存储在`uploads/`目录中
- 文件名会自动添加UUID以避免冲突
- 确保`uploads/`目录有适当的读写权限

### 3. 清理机制
- 系统会自动清理孤立文件
- 删除剪切板项目时会同时删除对应的物理文件
- 建议定期检查文件存储统计信息

### 4. 性能优化
- 大文件不再存储在数据库中，提高了数据库性能
- 文件传输更加高效
- 支持文件流式传输

## 故障排除

### 1. 文件上传失败
- 检查`uploads/`目录权限
- 确保磁盘空间充足
- 检查服务器日志

### 2. 文件下载失败
- 确认文件在`uploads/`目录中存在
- 检查数据库中的`file_path`字段
- 运行文件清理检查一致性

### 3. 清理问题
- 手动触发清理：`POST /api/files/cleanup`
- 检查清理状态：`GET /api/files/cleanup/status`
- 查看服务器日志了解详细信息

## API文档

完整的API文档可以在以下地址查看：
- Swagger UI: http://localhost:3001/api/docs
- JSON规范: http://localhost:3001/api/docs.json
