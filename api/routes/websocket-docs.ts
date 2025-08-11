/**
 * WebSocket 接口文档
 * 这个文件仅用于生成 Swagger 文档，不包含实际的路由逻辑
 */
import { Router } from 'express';

const router: Router = Router();

/**
 * @swagger
 * /ws:
 *   get:
 *     tags: [WebSocket]
 *     summary: WebSocket 连接端点
 *     description: |
 *       建立 WebSocket 连接以实时同步剪切板内容。
 *       
 *       **连接地址**: `ws://localhost:3002/ws?deviceId=your-device-id`
 *       
 *       **支持的消息类型**:
 *       
 *       ### 客户端发送的消息类型
 *       
 *       1. **获取所有剪切板内容** (`get_all_content`)
 *          ```json
 *          {
 *            "type": "get_all_content",
 *            "data": {
 *              "limit": 1000,
 *              "type": "text",
 *              "search": "关键词",
 *              "deviceId": "设备ID"
 *            }
 *          }
 *          ```
 *       
 *       2. **获取所有文本内容** (`get_all_text`)
 *          ```json
 *          {
 *            "type": "get_all_text"
 *          }
 *          ```
 *       
 *       3. **获取所有图片内容** (`get_all_images`)
 *          ```json
 *          {
 *            "type": "get_all_images"
 *          }
 *          ```
 *       
 *       4. **获取最新内容** (`get_latest`)
 *          ```json
 *          {
 *            "type": "get_latest",
 *            "count": 10
 *          }
 *          ```
 *       
 *       5. **同步剪切板内容** (`sync`)
 *          ```json
 *          {
 *            "type": "sync",
 *            "data": {
 *              "id": "uuid",
 *              "type": "text",
 *              "content": "剪切板内容",
 *              "deviceId": "设备ID"
 *            }
 *          }
 *          ```
 *       
 *       6. **删除剪切板内容** (`delete`)
 *          ```json
 *          {
 *            "type": "delete",
 *            "id": "要删除的项目ID"
 *          }
 *          ```
 *       
 *       ### 服务器发送的消息类型
 *       
 *       1. **所有剪切板内容** (`all_content`)
 *          ```json
 *          {
 *            "type": "all_content",
 *            "data": [剪切板项数组],
 *            "message": "成功获取 N 条剪切板内容",
 *            "count": 总数量
 *          }
 *          ```
 *       
 *       2. **所有文本内容** (`all_text`)
 *          ```json
 *          {
 *            "type": "all_text",
 *            "data": [文本剪切板项数组]
 *          }
 *          ```
 *       
 *       3. **所有图片内容** (`all_images`)
 *          ```json
 *          {
 *            "type": "all_images",
 *            "data": [图片剪切板项数组]
 *          }
 *          ```
 *       
 *       4. **最新内容** (`latest`)
 *          ```json
 *          {
 *            "type": "latest",
 *            "data": [最新剪切板项数组],
 *            "count": 请求的数量
 *          }
 *          ```
 *       
 *       5. **新增内容通知** (`sync`)
 *          ```json
 *          {
 *            "type": "sync",
 *            "data": 新的剪切板项
 *          }
 *          ```
 *       
 *       6. **删除内容通知** (`delete`)
 *          ```json
 *          {
 *            "type": "delete",
 *            "id": "被删除的项目ID"
 *          }
 *          ```
 *       
 *       7. **连接统计** (`connection_stats`)
 *          ```json
 *          {
 *            "type": "connection_stats",
 *            "data": {
 *              "totalConnections": 总连接数,
 *              "activeConnections": 活跃连接数,
 *              "connectedDevices": [设备列表]
 *            }
 *          }
 *          ```
 *       
 *       8. **错误消息** (`sync` with error)
 *          ```json
 *          {
 *            "type": "sync",
 *            "data": {
 *              "error": "错误信息"
 *            }
 *          }
 *          ```
 *       
 *       ### 连接参数
 *       - `deviceId`: 设备唯一标识符（可选，用于设备管理）
 *       
 *       ### 心跳机制
 *       - 服务器每30秒发送ping帧
 *       - 客户端应响应pong帧
 *       - 60秒无响应将断开连接
 *       
 *       ### 使用示例
 *       ```javascript
 *       const ws = new WebSocket('ws://localhost:3002/ws?deviceId=my-device');
 *       
 *       ws.onopen = () => {
 *         // 连接成功后获取所有剪切板内容
 *         ws.send(JSON.stringify({
 *           type: 'get_all_content',
 *           data: { limit: 100 }
 *         }));
 *       };
 *       
 *       ws.onmessage = (event) => {
 *         const message = JSON.parse(event.data);
 *         console.log('收到消息:', message);
 *       };
 *       ```
 *     parameters:
 *       - name: deviceId
 *         in: query
 *         description: 设备唯一标识符
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       101:
 *         description: WebSocket 连接升级成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */

// 这个路由不会被实际使用，仅用于文档生成
router.get('/ws', () => {
  // WebSocket 连接在 websocket.ts 中处理
});

export default router;
