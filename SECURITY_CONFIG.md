# 安全配置说明

## 功能介绍

本项目新增了安全配置功能，包含两个层面的安全验证：

1. **HTTP API安全验证**: 所有API请求都会自动附加自定义请求头，用于配合nginx等反向代理进行安全验证
2. **WebSocket连接安全验证**: WebSocket连接时会进行服务端验证，只有通过验证的连接才能正常通信

## 使用方法

1. 打开设置页面
2. 在"安全配置"部分填写：
   - **请求头名称 (Header Key)**: 建议使用 `X-API-Key` 或其他 `X-` 开头的自定义头
   - **请求头值 (Header Value)**: 输入一个复杂的随机字符串作为安全密钥
3. 点击"保存安全配置"按钮

配置保存后：
- 所有HTTP API请求会自动附加此请求头
- WebSocket连接会进行服务端安全验证
- 只有提供正确安全参数的连接才能建立WebSocket通信

## Nginx配置示例

在nginx配置文件中，可以通过以下方式验证自定义请求头：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location /api/ {
        # 检查自定义请求头
        if ($http_x_api_key != "your-secret-key-here") {
            return 403;
        }
        
        # 转发到后端服务
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location / {
        # 静态文件不需要验证请求头
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 更高级的nginx配置

如果需要更复杂的验证逻辑，可以使用nginx的map模块：

```nginx
# 在http块中定义
map $http_x_api_key $api_access {
    default 0;
    "your-secret-key-here" 1;
    "another-valid-key" 1;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location /api/ {
        # 检查API访问权限
        if ($api_access = 0) {
            return 403 "Access Denied";
        }
        
        proxy_pass http://localhost:3001;
        # ... 其他proxy设置
    }
}
```

## 安全建议

1. **使用强密钥**: 请求头值应该是一个长度至少32位的随机字符串
2. **定期更换**: 建议定期更换安全密钥
3. **HTTPS**: 在生产环境中务必使用HTTPS，避免请求头在传输过程中被窃取
4. **日志记录**: 在nginx中记录访问日志，监控异常访问

## 生成安全密钥

可以使用以下命令生成安全的随机密钥：

```bash
# 生成32位随机字符串
openssl rand -hex 32

# 或者使用base64编码
openssl rand -base64 32
```

## WebSocket安全验证

WebSocket连接的安全验证工作流程：

1. **前端连接**: 当建立WebSocket连接时，前端会自动将安全参数添加到连接URL中
2. **服务端验证**: WebSocket服务器会验证连接参数中的安全信息
3. **连接控制**: 只有通过验证的连接才能建立，未通过验证的连接会被立即关闭
4. **消息过滤**: 只有已验证的连接才能发送和接收WebSocket消息

## 注意事项

- 配置保存在浏览器本地存储中，清除浏览器数据会丢失配置
- 只有当请求头名称和值都不为空时，才会启用安全验证
- HTTP API验证由nginx负责，WebSocket验证由后端服务器负责
- 修改安全配置后，现有的WebSocket连接会自动重连以应用新的安全参数
- 如果清空安全配置，则禁用所有安全验证，允许任意连接
