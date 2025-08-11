import express, { Request, Response } from 'express';
import type { ApiResponse } from '../types/shared';
import { getWebSocketManager } from '../server.js';

const router: express.Router = express.Router();

/**
 * @swagger
 * /devices/connections:
 *   get:
 *     tags: [Devices]
 *     summary: 获取WebSocket连接统计
 *     description: 获取当前WebSocket连接的统计信息，包括总连接数、活跃连接数等
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ConnectionStats'
 *       503:
 *         description: WebSocket服务器未启动
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/connections', async (req: Request, res: Response) => {
  try {
    const wsManager = getWebSocketManager();

    if (!wsManager) {
      return res.status(503).json({
        success: false,
        message: 'WebSocket服务器未启动'
      });
    }

    const stats = wsManager.getStats();

    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats
    };

    res.json(response);
  } catch (error) {
    console.error('获取连接统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取连接统计失败'
    });
  }
});



export default router;