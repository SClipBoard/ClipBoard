# API 安全请求头附加功能实现文档

## 概述

本文档详细说明了如何在共享剪切板项目中实现API安全请求头附加功能，使所有文件预览和下载请求都能自动附加用户配置的安全请求头，以配合nginx等反向代理进行安全验证。

## 问题背景

原有的文件预览请求使用直接的URL方式：
```
/api/files/{id}/preview
```

这种方式无法附加自定义请求头，导致无法配合nginx等反向代理进行安全验证。

## 解决方案

### 1. 后端路由修改

#### 1.1 新增查询参数版本的API路由

在 `api/routes/files.ts` 中新增了两个路由：

**预览路由：**
```typescript
router.get('/preview', async (req: Request, res: Response) => {
  const { id, name } = req.query;
  // 处理逻辑...
});
```

**下载路由：**
```typescript
router.get('/download', async (req: Request, res: Response) => {
  const { id, name } = req.query;
  // 处理逻辑...
});
```

#### 1.2 路由顺序的重要性

**关键注意事项：** 必须将具体路由放在参数路由之前，否则会被参数路由拦截。

正确的路由顺序：
1. `/preview` - 查询参数版本预览
2. `/download` - 查询参数版本下载
3. `/:id` - 路径参数版本下载
4. `/:id/preview` - 路径参数版本预览
5. `/stats` - 统计信息
6. `/cleanup/status` - 清理状态

**错误示例：**
```typescript
router.get('/:id', ...);        // 这会匹配 /download
router.get('/download', ...);   // 永远不会被执行
```

### 2. 前端API客户端修改

#### 2.1 新增安全文件请求方法

在 `src/lib/api.ts` 中新增了两个方法：

```typescript
async getFilePreview(fileId: string, fileName?: string): Promise<Blob> {
  let url = `${getApiBaseUrl()}/files/preview`;
  
  // 构建查询参数
  const params = new URLSearchParams();
  params.append('id', fileId);
  if (fileName) {
    params.append('name', fileName);
  }
  
  url += `?${params.toString()}`;
  
  // 获取安全配置的请求头
  let securityHeaders: Record<string, string> = {};
  try {
    const securityConfig = localStorage.getItem('security-config');
    if (securityConfig) {
      const parsed = JSON.parse(securityConfig);
      const config = parsed.state?.config || {};
      
      if (config.customHeaderKey?.trim() && config.customHeaderValue?.trim()) {
        securityHeaders[config.customHeaderKey.trim()] = config.customHeaderValue.trim();
      }
    }
  } catch (error) {
    console.warn('获取安全配置失败:', error);
    securityHeaders = useSecurityStore.getState().getHeaders();
  }
  
  const response = await fetch(url, {
    headers: {
      ...securityHeaders,
    },
  });
  
  return await response.blob();
}
```

#### 2.2 安全配置获取策略

采用双重保障策略：
1. **主要方式：** 直接从 localStorage 读取配置
2. **降级方式：** 使用 zustand store 的 getHeaders() 方法

### 3. 前端组件修改

#### 3.1 创建 SecureImage 组件

创建了 `src/components/SecureImage.tsx` 组件：

```typescript
export default function SecureImage({ fileId, alt, className, fileName, onError }: SecureImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const loadImage = async () => {
      // 使用安全的API请求获取图片数据
      const blob = await apiClient.getFilePreview(fileId, fileName);
      
      // 创建blob URL
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
    };
    
    loadImage();
    
    return () => {
      // 清理blob URL
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, [fileId, fileName]);
  
  return <img src={imageUrl} alt={alt} className={className} />;
}
```

#### 3.2 修改 ClipboardItem 组件

替换原有的直接 `<img>` 标签：

```typescript
// 旧方式（无法附加请求头）
<img src={`${getApiBaseUrl()}/files/${item.id}/preview`} />

// 新方式（支持安全请求头）
{item.filePath ? (
  <SecureImage
    fileId={item.id}
    alt="剪切板图片"
    className="max-w-full max-h-32 rounded-lg object-contain"
    fileName={item.fileName}
  />
) : (
  <img src={item.content} alt="剪切板图片" />
)}
```

## 请求URL格式

### 新的请求格式

**预览请求：**
```
GET /api/files/preview?id=3b6b48fe-a70b-4ba6-8d89-142598b00f09&name=clipboard-image-1754919776291.png
```

**下载请求：**
```
GET /api/files/download?id=02b68174-85f8-4f61-a291-4e75007f10cd&name=server-management-panel-windows-build.zip
```

### 请求头附加

所有请求都会自动附加用户在设置中配置的安全请求头：
```
X-API-Key: your-secret-key-here
```

## 兼容性处理

### 向后兼容

- 保留了原有的路径参数版本路由 `/:id` 和 `/:id/preview`
- 对于旧的 base64 存储方式，继续使用原有的 `<img>` 标签
- 新的文件存储方式（有 `filePath` 字段）使用新的安全请求方式

### 判断逻辑

```typescript
{item.filePath ? (
  // 新的文件存储方式，使用安全请求
  <SecureImage fileId={item.id} fileName={item.fileName} />
) : (
  // 旧的base64方式，直接使用content
  <img src={item.content} />
)}
```

## 关键注意事项

### 1. 路由顺序至关重要

Express.js 按照路由定义的顺序进行匹配，参数路由（如 `/:id`）会匹配任何路径，因此必须将具体路由放在参数路由之前。

### 2. 内存管理

使用 `URL.createObjectURL()` 创建的 blob URL 必须及时清理：

```typescript
useEffect(() => {
  return () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
  };
}, []);
```

### 3. 错误处理

- API请求失败时显示错误状态
- 安全配置获取失败时使用降级方案
- 图片加载失败时显示占位符

### 4. 调试技巧

添加调试日志来跟踪请求：

```typescript
// 路由中间件
router.use((req, res, next) => {
  console.log(`文件路由请求: ${req.method} ${req.path}`, req.query);
  next();
});

// 具体路由
router.get('/download', async (req, res) => {
  console.log('下载路由被调用，查询参数:', req.query);
  // ...
});
```

## 测试验证

### 1. 检查请求头

在浏览器开发者工具的网络面板中，确认请求包含了正确的安全请求头。

### 2. 检查路由匹配

通过服务器日志确认请求被正确的路由处理器接收。

### 3. 功能测试

- 图片预览是否正常显示
- 文件下载是否正常工作
- 安全配置是否正确附加

## 部署注意事项

### 1. 服务器重启

修改路由后必须重启服务器才能生效。

### 2. nginx配置

确保nginx配置正确验证自定义请求头：

```nginx
location /api/files/ {
    if ($http_x_api_key != "your-secret-key-here") {
        return 403;
    }
    proxy_pass http://localhost:3001;
}
```

### 3. HTTPS

在生产环境中务必使用HTTPS，避免请求头在传输过程中被窃取。

## 总结

通过本次修改，成功实现了：

1. **安全性增强：** 所有文件请求都能附加自定义安全请求头
2. **灵活性提升：** 支持传递文件名参数
3. **向后兼容：** 保持对旧数据格式的支持
4. **用户体验：** 无缝的安全验证，用户无感知

这个实现为项目提供了强大的安全基础，可以配合各种反向代理进行访问控制。
