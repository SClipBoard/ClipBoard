# 文件清理策略使用指南

## 概述

文件清理策略是剪切板同步服务的一个重要功能，专门用于管理文件类型的剪切板内容。当文件数量超过设定的限制时，系统会根据配置的策略自动删除多余的文件，以控制存储空间的使用。

## 配置选项

### 用户配置文件 (user-config.json)

```json
{
  "maxItems": 1000,
  "autoCleanupDays": 30,
  "fileCleanup": {
    "enabled": false,
    "maxFileCount": 100,
    "strategy": "oldest_first"
  }
}
```

### 配置字段说明

- **enabled**: 是否启用文件清理功能
- **maxFileCount**: 允许保留的最大文件数量
- **strategy**: 清理策略
  - `oldest_first`: 最旧优先 - 按创建时间排序，删除最旧的文件
  - `largest_first`: 最大优先 - 按文件大小排序，删除最大的文件

## API 接口

### 1. 更新配置

**接口**: `PUT /api/config`

**请求体示例**:
```json
{
  "fileCleanup": {
    "enabled": true,
    "maxFileCount": 50,
    "strategy": "oldest_first"
  }
}
```

### 2. 手动文件清理

**接口**: `POST /api/config/cleanup-files`

**请求体示例**:
```json
{
  "maxFileCount": 30,
  "strategy": "largest_first"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "deletedCount": 15,
    "remainingCount": 30
  },
  "message": "文件清理完成，删除了 15 个文件，剩余 30 个文件"
}
```

### 3. 综合清理

**接口**: `POST /api/config/cleanup`

**请求体示例**:
```json
{
  "maxFileCount": 40,
  "fileCleanupStrategy": "oldest_first",
  "maxCount": 500
}
```

## 清理策略详解

### 最旧优先 (oldest_first)

- **排序规则**: 按 `created_at` 字段升序排列
- **删除顺序**: 删除创建时间最早的文件
- **适用场景**: 希望保留最新的文件，删除历史文件
- **优点**: 保持文件的时效性，适合大多数使用场景

### 最大优先 (largest_first)

- **排序规则**: 按 `file_size` 字段降序排列，文件大小相同时按创建时间排序
- **删除顺序**: 删除文件大小最大的文件
- **适用场景**: 希望节省存储空间，优先删除占用空间大的文件
- **优点**: 能够快速释放存储空间

## 自动清理机制

### 触发时机

1. **上传新文件时**: 每次通过 `POST /api/clipboard` 上传新内容后
2. **配置更新后**: 当文件清理配置被修改时
3. **手动触发**: 通过清理接口主动触发

### 执行顺序

1. **文件清理**: 如果启用文件清理且文件数量超限，先执行文件清理
2. **总数量清理**: 再检查总条目数是否超过 `maxItems` 限制
3. **日期清理**: 最后执行基于日期的清理（如果配置了 `autoCleanupDays`）

## 使用建议

### 推荐配置

**轻量使用场景**:
```json
{
  "fileCleanup": {
    "enabled": true,
    "maxFileCount": 20,
    "strategy": "oldest_first"
  }
}
```

**重度使用场景**:
```json
{
  "fileCleanup": {
    "enabled": true,
    "maxFileCount": 100,
    "strategy": "largest_first"
  }
}
```

**存储敏感场景**:
```json
{
  "fileCleanup": {
    "enabled": true,
    "maxFileCount": 50,
    "strategy": "largest_first"
  }
}
```

### 最佳实践

1. **合理设置文件数量限制**: 根据实际使用需求和存储空间设置合适的 `maxFileCount`
2. **选择合适的清理策略**: 
   - 日常使用推荐 `oldest_first`
   - 存储空间紧张时使用 `largest_first`
3. **定期监控**: 通过 `/api/config/stats` 接口监控文件数量和存储使用情况
4. **测试清理效果**: 在生产环境使用前，先在测试环境验证清理策略的效果

## 监控和统计

### 获取统计信息

**接口**: `GET /api/config/stats`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalItems": 150,
    "textItems": 80,
    "imageItems": 45,
    "fileItems": 25,
    "totalSize": "15.6 MB"
  }
}
```

### 日志监控

系统会在控制台输出清理相关的日志信息：

```
自动清理检查: 当前条目数=120, 最大条目数=100
文件清理检查: 当前文件数=35, 文件清理配置={"enabled":true,"maxFileCount":30,"strategy":"oldest_first"}
开始文件清理，需要删除 5 个文件
文件清理完成，实际删除了 5 个文件，当前剩余 30 个文件
```

## 注意事项

1. **不可逆操作**: 文件清理是不可逆的，被删除的文件无法恢复
2. **性能影响**: 大量文件清理可能会影响数据库性能，建议在低峰期执行
3. **配置生效**: 配置更改后立即生效，下次上传内容时会应用新的清理策略
4. **文件大小**: `largest_first` 策略依赖 `file_size` 字段，如果文件没有大小信息，会按创建时间排序
5. **并发安全**: 清理操作是原子性的，但在高并发场景下可能需要额外的锁机制

## 故障排除

### 常见问题

1. **清理不生效**: 检查 `fileCleanup.enabled` 是否为 `true`
2. **删除数量不符合预期**: 检查数据库中的实际文件数量和配置的 `maxFileCount`
3. **策略不生效**: 确认 `strategy` 字段值正确（`oldest_first` 或 `largest_first`）

### 调试方法

1. 查看控制台日志输出
2. 使用统计接口检查文件数量
3. 手动执行清理接口测试功能
