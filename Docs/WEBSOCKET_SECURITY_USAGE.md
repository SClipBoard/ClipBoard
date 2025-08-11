# WebSocket安全验证使用说明

## 功能概述

WebSocket安全验证功能为共享剪切板项目提供了双重安全保护：
1. HTTP API请求头验证（由nginx处理）
2. WebSocket连接服务端验证（由后端服务器处理）

## 配置步骤

### 1. 前端配置

1. 访问应用的设置页面
2. 找到"安全配置"部分
3. 填写安全参数：
   - **请求头名称**: 例如 `X-API-Key`
   - **请求头值**: 例如 `abc123def456ghi789`
4. 点击"保存安全配置"

### 2. nginx配置（HTTP API验证）

在nginx配置文件中添加请求头验证：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # API路由需要验证请求头
    location /api/ {
        if ($http_x_api_key != "abc123def456ghi789") {
            return 403 "Access Denied";
        }
        
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 静态文件不需要验证
    location / {
        proxy_pass http://localhost:5173;
        # ... 其他配置
    }
}
```

## 工作原理

### HTTP API验证流程

1. 用户在前端配置安全参数
2. 前端所有API请求自动附加自定义请求头
3. nginx检查请求头，验证通过才转发到后端
4. 后端正常处理业务逻辑

### WebSocket验证流程

1. 用户保存安全配置时，前端同时调用后端API设置WebSocket安全参数
2. 前端建立WebSocket连接时，将安全参数添加到连接URL中
3. WebSocket服务器验证连接参数
4. 验证通过：建立连接，允许正常通信
5. 验证失败：立即关闭连接，返回错误码1008

## 安全特性

### 连接验证
- 未配置安全参数：允许所有连接（向后兼容）
- 配置了安全参数：只允许提供正确参数的连接

### 消息过滤
- 只有通过验证的连接才能发送和接收消息
- 未验证连接的消息会被忽略

### 动态更新
- 修改安全配置后，WebSocket连接会自动重连
- 新的连接会使用最新的安全参数

## 测试方法

### 1. 测试HTTP API验证

```bash
# 不带请求头的请求（应该被nginx拒绝）
curl -X GET http://your-domain.com/api/config

# 带正确请求头的请求（应该成功）
curl -X GET http://your-domain.com/api/config \
  -H "X-API-Key: abc123def456ghi789"

# 带错误请求头的请求（应该被nginx拒绝）
curl -X GET http://your-domain.com/api/config \
  -H "X-API-Key: wrong-key"
```

### 2. 测试WebSocket验证

可以通过浏览器开发者工具观察WebSocket连接：

1. 打开浏览器开发者工具
2. 切换到Network标签
3. 筛选WS（WebSocket）连接
4. 观察连接状态和错误信息

## 故障排除

### WebSocket连接失败
- 检查浏览器控制台是否有错误信息
- 确认安全配置是否正确保存
- 检查服务器日志中的验证失败信息

### API请求被拒绝
- 检查nginx配置是否正确
- 确认请求头名称和值是否匹配
- 查看nginx访问日志

### 配置不生效
- 清除浏览器缓存和本地存储
- 重新配置安全参数
- 重启服务器应用

## 安全建议

1. **使用强密钥**: 安全参数值应该是长度至少32位的随机字符串
2. **定期更换**: 建议定期更换安全密钥
3. **HTTPS部署**: 生产环境务必使用HTTPS
4. **日志监控**: 监控异常访问和连接尝试
5. **访问控制**: 结合IP白名单等其他安全措施
