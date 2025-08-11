import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { ClipboardItem, ApiResponse, UploadRequest, PaginationParams } from '../types/shared';
import { ClipboardItemDAO } from '../database.js';
import { getWebSocketManager } from '../server.js';
import { readUserConfig } from './config.js';

const router: express.Router = express.Router();

/**
 * 自动清理超出最大条目数的内容
 */
async function autoCleanupIfNeeded(): Promise<void> {
  try {
    const userConfig = await readUserConfig();
    const currentCount = await ClipboardItemDAO.getCount();

    console.log(`自动清理检查: 当前条目数=${currentCount}, 最大条目数=${userConfig.maxItems}`);

    if (currentCount > userConfig.maxItems) {
      // 从最旧的开始删除，直到数量小于等于最大条目数
      const deleteCount = currentCount - userConfig.maxItems;
      console.log(`开始自动清理，需要删除 ${deleteCount} 个最旧的项目`);

      const deletedCount = await ClipboardItemDAO.cleanupByCount(userConfig.maxItems);

      const newCount = await ClipboardItemDAO.getCount();
      console.log(`自动清理完成，实际删除了 ${deletedCount} 个项目，当前剩余 ${newCount} 个项目`);
    } else {
      console.log('无需清理，当前条目数未超过限制');
    }
  } catch (error) {
    console.error('自动清理失败:', error);
    // 清理失败不影响主要功能
  }
}

/**
 * @swagger
 * /clipboard:
 *   get:
 *     tags: [Clipboard]
 *     summary: 获取剪切板内容列表
 *     description: 分页获取剪切板内容，支持类型筛选、搜索和设备筛选
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/TypeParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - $ref: '#/components/parameters/FilterParam'
 *       - $ref: '#/components/parameters/DeviceIdParam'
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
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ClipboardItem'
 *                     total:
 *                       type: number
 *                       description: 总条目数
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      search,
      filter,
      deviceId
    } = req.query as PaginationParams & { deviceId?: string };

    // 处理特殊筛选
    let queryType = type as 'text' | 'image' | undefined;
    let queryLimit = Math.max(1, Math.min(100, Number(limit)));
    
    if (filter) {
      switch (filter) {
        case 'all_text':
          queryType = 'text';
          break;
        case 'all_images':
          queryType = 'image';
          break;
        case 'latest':
          // 获取最新的内容，这里默认取前10个
          queryLimit = 10;
          break;
      }
    }

    // 使用数据库DAO获取数据
    const queryParams = {
      page: Math.max(1, Number(page)),
      limit: queryLimit,
      type: queryType,
      search: typeof search === 'string' ? search : undefined,
      deviceId: typeof deviceId === 'string' ? deviceId : undefined
    };

    const result = await ClipboardItemDAO.getItems(queryParams);

    const response: ApiResponse<ClipboardItem[]> = {
      success: true,
      data: result.items,
      total: result.total
    };

    res.json(response);
  } catch (error) {
    console.error('获取剪切板内容失败:', error);
    res.status(500).json({
      success: false,
      message: '获取剪切板内容失败'
    });
  }
});

/**
 * @swagger
 * /clipboard:
 *   post:
 *     tags: [Clipboard]
 *     summary: 上传剪切板内容
 *     description: 创建新的剪切板内容项
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UploadRequest'
 *     responses:
 *       201:
 *         description: 上传成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ClipboardItem'
 *       400:
 *         description: 请求参数错误
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { type, content, deviceId, fileName, fileSize, mimeType }: UploadRequest = req.body;

    // 验证必需字段
    if (!type || !content || !deviceId) {
      return res.status(400).json({
        success: false,
        message: '缺少必需字段: type, content, deviceId'
      });
    }

    // 验证类型
    if (type !== 'text' && type !== 'image' && type !== 'file') {
      return res.status(400).json({
        success: false,
        message: '无效的内容类型，只支持 text、image 或 file'
      });
    }

    // 创建新的剪切板项
    const newItemData: {
      id: string;
      type: 'text' | 'image' | 'file';
      content: string;
      deviceId: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    } = {
      id: uuidv4(),
      type,
      content,
      deviceId
    };

    // 如果是文件类型，添加文件相关信息
    if (type === 'file') {
      if (!fileName) {
        return res.status(400).json({
          success: false,
          message: '文件类型需要提供文件名'
        });
      }
      newItemData.fileName = fileName;
      newItemData.fileSize = fileSize;
      newItemData.mimeType = mimeType;
    }

    // 使用数据库DAO创建项目
    const newItem = await ClipboardItemDAO.create(newItemData);

    // 自动清理：检查是否超过最大条目数（在创建新项目后执行）
    await autoCleanupIfNeeded();

    // 通过WebSocket广播新内容
    const wsManager = getWebSocketManager();
    if (wsManager) {
      wsManager.broadcastNewItem(newItem);
    }

    const response: ApiResponse<ClipboardItem> = {
      success: true,
      data: newItem,
      message: '内容上传成功'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('上传剪切板内容失败:', error);
    res.status(500).json({
      success: false,
      message: '上传剪切板内容失败'
    });
  }
});

/**
 * @swagger
 * /clipboard/{id}:
 *   delete:
 *     tags: [Clipboard]
 *     summary: 删除剪切板内容
 *     description: 根据ID删除指定的剪切板内容项
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: 删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 未找到指定内容
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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 使用数据库DAO删除项目
    const deleted = await ClipboardItemDAO.delete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '未找到指定的剪切板内容'
      });
    }

    // 通过WebSocket广播删除消息
    const wsManager = getWebSocketManager();
    if (wsManager) {
      wsManager.broadcastDeleteItem(id);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: '删除成功'
    };

    res.json(response);
  } catch (error) {
    console.error('删除剪切板内容失败:', error);
    res.status(500).json({
      success: false,
      message: '删除剪切板内容失败'
    });
  }
});

/**
 * @swagger
 * /clipboard/{id}:
 *   get:
 *     tags: [Clipboard]
 *     summary: 获取单个剪切板内容
 *     description: 根据ID获取指定的剪切板内容项详情
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
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
 *                       $ref: '#/components/schemas/ClipboardItem'
 *       404:
 *         description: 未找到指定内容
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
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 使用数据库DAO获取项目
    const item = await ClipboardItemDAO.getById(id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '未找到指定的剪切板内容'
      });
    }

    const response: ApiResponse<ClipboardItem> = {
      success: true,
      data: item
    };

    res.json(response);
  } catch (error) {
    console.error('获取剪切板内容失败:', error);
    res.status(500).json({
      success: false,
      message: '获取剪切板内容失败'
    });
  }
});

export default router;