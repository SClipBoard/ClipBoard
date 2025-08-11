# API 文档更新说明

## 概述

本文档说明了为支持安全请求头功能而对 `/api/docs` Swagger 文档进行的更新。

## 更新内容

### 1. 新增安全配置说明

在 API 文档的主页面添加了详细的安全功能说明：

- **配置方式**：如何在前端设置页面配置安全请求头
- **支持的接口**：哪些接口支持安全请求头
- **nginx配置示例**：如何在反向代理中验证请求头
- **注意事项**：使用建议和安全提醒

### 2. 新增安全相关参数定义

在 `components.parameters` 中添加了：

```yaml
FileIdQueryParam:
  name: id
  in: query
  description: 文件ID（剪切板项目ID）
  required: true
  schema:
    type: string

FileNameQueryParam:
  name: name
  in: query
  description: 文件名（可选，用于设置下载文件名）
  required: false
  schema:
    type: string
```

### 3. 新增安全认证方案

在 `components.securitySchemes` 中添加了：

```yaml
CustomHeader:
  type: apiKey
  in: header
  name: X-API-Key
  description: 自定义安全请求头，可在设置中配置。配置后所有文件相关请求都会自动附加此请求头。
```

### 4. 更新文件接口文档

#### 4.1 新的查询参数版本接口

**`/files/preview` - 文件预览（推荐）**

- 添加了详细的安全功能说明
- 标注了 `security: [CustomHeader: []]`
- 使用参数引用：`$ref: '#/components/parameters/FileIdQueryParam'`
- 添加了更详细的响应示例和错误处理

**`/files/download` - 文件下载（推荐）**

- 添加了详细的安全功能说明
- 标注了 `security: [CustomHeader: []]`
- 添加了响应头说明（Content-Type, Content-Disposition, Content-Length）
- 提供了多种文件类型的响应示例

#### 4.2 传统路径参数版本接口

**`/files/{id}` - 文件下载（传统版本）**

- 标注为"传统路径参数版本"
- 添加了推荐使用新版本的说明
- 明确标注了限制：不支持安全请求头和自定义文件名

**`/files/{id}/preview` - 文件预览（传统版本）**

- 标注为"传统路径参数版本"
- 添加了推荐使用新版本的说明
- 明确标注了限制：不支持安全请求头和自定义文件名

## 文档结构对比

### 更新前
```
/files/{id} - 下载文件
/files/{id}/preview - 预览文件
/files/stats - 文件统计
```

### 更新后
```
/files/preview - 预览文件（查询参数版本，支持安全请求头）⭐ 推荐
/files/download - 下载文件（查询参数版本，支持安全请求头）⭐ 推荐
/files/{id} - 下载文件（传统版本，向后兼容）
/files/{id}/preview - 预览文件（传统版本，向后兼容）
/files/stats - 文件统计
```

## 使用指南

### 1. 查看安全功能说明

访问 `/api/docs` 后，在页面顶部可以看到详细的安全功能说明，包括：
- 配置步骤
- 支持的接口列表
- nginx配置示例
- 安全建议

### 2. 测试新接口

在 Swagger UI 中：

1. **配置安全认证**：
   - 点击页面右上角的 "Authorize" 按钮
   - 在 "CustomHeader (apiKey)" 部分输入你的安全密钥
   - 点击 "Authorize"

2. **测试预览接口**：
   - 找到 `/files/preview` 接口
   - 输入文件ID和可选的文件名
   - 点击 "Try it out" 执行请求

3. **测试下载接口**：
   - 找到 `/files/download` 接口
   - 输入文件ID和可选的文件名
   - 点击 "Try it out" 执行请求

### 3. 对比新旧接口

文档中清楚地标注了：
- ⭐ **推荐使用**：查询参数版本（支持安全请求头）
- 📋 **向后兼容**：路径参数版本（传统版本）

## 技术实现细节

### 1. 参数复用

使用 `$ref` 引用公共参数定义，避免重复：

```yaml
parameters:
  - $ref: '#/components/parameters/FileIdQueryParam'
  - $ref: '#/components/parameters/FileNameQueryParam'
```

### 2. 安全标注

在支持安全请求头的接口中添加：

```yaml
security:
  - CustomHeader: []
```

### 3. 详细的响应说明

为新接口添加了：
- 多种内容类型的响应示例
- 详细的错误响应示例
- 响应头说明

## 维护建议

### 1. 保持文档同步

当添加新的安全功能时，记得同步更新：
- Swagger 文档注释
- 参数定义
- 安全方案说明

### 2. 版本管理

- 新功能使用新的接口路径
- 保留旧接口用于向后兼容
- 在文档中明确标注推荐使用的版本

### 3. 示例更新

定期检查和更新：
- nginx配置示例
- 安全密钥生成方法
- 错误响应示例

## 总结

通过这次更新，API 文档现在能够：

1. **清楚地展示安全功能**：用户可以快速了解如何配置和使用安全请求头
2. **区分新旧接口**：明确标注推荐使用的接口版本
3. **提供完整的使用指南**：从配置到测试的完整流程
4. **支持实际测试**：在 Swagger UI 中可以直接测试安全功能

这些更新使得 API 文档更加完整和用户友好，有助于开发者正确使用安全功能。
