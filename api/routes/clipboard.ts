import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { ClipboardItem, ApiResponse, UploadRequest, PaginationParams } from '../../shared/types.js';
import { ClipboardItemDAO } from '../database.js';
import { getWebSocketManager } from '../server.js';

const router = express.Router();

/**
 * 获取剪切板内容列表
 * GET /api/clipboard
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      search,
      filter
    } = req.query as PaginationParams;

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
    const result = await ClipboardItemDAO.getItems({
      page: Math.max(1, Number(page)),
      limit: queryLimit,
      type: queryType,
      search: typeof search === 'string' ? search : undefined
    });

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
 * 上传剪切板内容
 * POST /api/clipboard
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
 * 删除剪切板内容
 * DELETE /api/clipboard/:id
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
 * 获取单个剪切板内容
 * GET /api/clipboard/:id
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