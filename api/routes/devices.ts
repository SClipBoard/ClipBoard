import express, { Request, Response } from 'express';
import type { ApiResponse } from '../types/shared';
import { getWebSocketManager } from '../server.js';

const router: express.Router = express.Router();

/**
 * 获取WebSocket连接统计
 * GET /api/devices/connections
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