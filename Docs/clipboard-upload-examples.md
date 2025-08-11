# 剪切板上传接口使用说明

## 接口地址
`POST /api/clipboard`

## 支持的内容类型

### 1. 文本类型 (text)

**请求示例：**
```json
{
  "type": "text",
  "content": "这是一段文本内容",
  "deviceId": "device-001"
}
```

**字段说明：**
- `type`: 固定为 "text"
- `content`: 纯文本内容
- `deviceId`: 设备标识符

### 2. 图片类型 (image)

**请求示例：**
```json
{
  "type": "image",
  "content": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "deviceId": "device-001",
  "fileName": "screenshot.png",
  "fileSize": 1024,
  "mimeType": "image/png"
}
```

**字段说明：**
- `type`: 固定为 "image"
- `content`: Base64编码的图片数据，需要包含完整的 data URL 格式（如：`data:image/png;base64,xxx`）
- `deviceId`: 设备标识符
- `fileName`: 图片文件名（可选）
- `fileSize`: 文件大小，单位为字节（可选）
- `mimeType`: MIME类型，如 "image/png", "image/jpeg" 等（可选）

**如何获取Base64编码的图片：**
1. 使用JavaScript: `canvas.toDataURL()` 或 `FileReader.readAsDataURL()`
2. 使用Python: `base64.b64encode(image_data).decode()`
3. 使用命令行: `base64 -i image.png`

### 3. 文件类型 (file)

**请求示例：**
```json
{
  "type": "file",
  "content": "SGVsbG8gV29ybGQh",
  "deviceId": "device-001",
  "fileName": "document.txt",
  "fileSize": 12,
  "mimeType": "text/plain"
}
```

**字段说明：**
- `type`: 固定为 "file"
- `content`: Base64编码的文件数据（不需要data URL前缀）
- `deviceId`: 设备标识符
- `fileName`: 文件名（**必需**）
- `fileSize`: 文件大小，单位为字节（可选）
- `mimeType`: MIME类型，如 "text/plain", "application/pdf", "application/zip" 等（可选）

**如何获取Base64编码的文件：**
1. 使用JavaScript: `FileReader.readAsDataURL()` 然后去掉前缀
2. 使用Python: `base64.b64encode(file_data).decode()`
3. 使用命令行: `base64 -i file.txt`

## 常见MIME类型参考

### 图片类型
- PNG: `image/png`
- JPEG: `image/jpeg`
- GIF: `image/gif`
- WebP: `image/webp`
- SVG: `image/svg+xml`

### 文档类型
- 纯文本: `text/plain`
- PDF: `application/pdf`
- Word文档: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Excel表格: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### 压缩文件
- ZIP: `application/zip`
- RAR: `application/vnd.rar`
- 7Z: `application/x-7z-compressed`

## 响应格式

**成功响应 (201)：**
```json
{
  "success": true,
  "data": {
    "id": "uuid-string",
    "type": "text",
    "content": "内容数据",
    "deviceId": "device-001",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "内容上传成功"
}
```

**错误响应 (400/500)：**
```json
{
  "success": false,
  "message": "错误描述"
}
```

## 注意事项

1. **文件大小限制**：建议单个文件不超过10MB
2. **Base64编码**：会增加约33%的数据大小
3. **文件类型验证**：服务器会验证必需字段，文件类型必须提供fileName
4. **设备ID**：用于区分不同设备，建议使用唯一标识符
5. **内容去重**：相同内容可能会被去重处理
