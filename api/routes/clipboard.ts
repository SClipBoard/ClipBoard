import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { ClipboardItem, ApiResponse, UploadRequest, PaginationParams, FileUploadRequest, UpdateRequest } from '../types/shared';
import { ClipboardItemDAO } from '../database.js';
import { getWebSocketManager } from '../server.js';
import { readUserConfig } from './config.js';
import { uploadSingle, handleUploadError } from '../middleware/upload.js';
import { saveFileFromBase64 } from '../utils/fileStorage.js';

const router: express.Router = express.Router();

/**
 * 自动清理超出最大条目数的内容
 */
async function autoCleanupIfNeeded(): Promise<void> {
  try {
    const userConfig = await readUserConfig();
    const currentCount = await ClipboardItemDAO.getCount();
    const currentFileCount = await ClipboardItemDAO.getFileCount();

    console.log(`自动清理检查: 当前条目数=${currentCount}, 最大条目数=${userConfig.maxItems}`);
    console.log(`文件清理检查: 当前文件数=${currentFileCount}, 文件清理配置=${JSON.stringify(userConfig.fileCleanup)}`);

    // 先执行文件清理（如果启用）
    if (userConfig.fileCleanup?.enabled && currentFileCount > userConfig.fileCleanup.maxFileCount) {
      const fileDeleteCount = currentFileCount - userConfig.fileCleanup.maxFileCount;
      console.log(`开始文件清理，需要删除 ${fileDeleteCount} 个文件`);

      const fileDeletedCount = await ClipboardItemDAO.cleanupFilesByCount(
        userConfig.fileCleanup.maxFileCount,
        userConfig.fileCleanup.strategy
      );

      const newFileCount = await ClipboardItemDAO.getFileCount();
      console.log(`文件清理完成，实际删除了 ${fileDeletedCount} 个文件，当前剩余 ${newFileCount} 个文件`);
    }

    // 再执行总数量清理
    const updatedCount = await ClipboardItemDAO.getCount();
    if (updatedCount > userConfig.maxItems) {
      // 从最旧的开始删除，直到数量小于等于最大条目数
      const deleteCount = updatedCount - userConfig.maxItems;
      console.log(`开始总数量清理，需要删除 ${deleteCount} 个最旧的项目`);

      const deletedCount = await ClipboardItemDAO.cleanupByCount(userConfig.maxItems);

      const newCount = await ClipboardItemDAO.getCount();
      console.log(`总数量清理完成，实际删除了 ${deletedCount} 个项目，当前剩余 ${newCount} 个项目`);
    } else {
      console.log('无需总数量清理，当前条目数未超过限制');
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
 * /clipboard/upload:
 *   post:
 *     tags: [Clipboard]
 *     summary: 上传文件到剪切板
 *     description: |
 *       通过multipart/form-data上传文件到剪切板，支持所有文件类型，不限制大小
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 要上传的文件
 *               type:
 *                 type: string
 *                 enum: [file, image]
 *                 description: 文件类型
 *               deviceId:
 *                 type: string
 *                 description: 设备ID
 *               fileName:
 *                 type: string
 *                 description: 自定义文件名（可选）
 *             required:
 *               - file
 *               - type
 *               - deviceId
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
router.post('/upload', uploadSingle, handleUploadError, async (req: Request, res: Response) => {
  try {
    const { type, deviceId, fileName }: FileUploadRequest = req.body;
    const uploadedFile = req.file;

    // 验证必需字段
    if (!type || !deviceId) {
      return res.status(400).json({
        success: false,
        message: '缺少必需字段: type, deviceId'
      });
    }

    // 验证文件
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: '未上传文件'
      });
    }

    // 验证类型
    if (type !== 'file' && type !== 'image') {
      return res.status(400).json({
        success: false,
        message: '无效的内容类型，只支持 file 或 image'
      });
    }

    // 创建新的剪切板项
    const newItemData: Omit<ClipboardItem, 'createdAt' | 'updatedAt'> = {
      id: uuidv4(),
      type,
      content: uploadedFile.filename, // 存储文件名作为内容标识
      deviceId,
      fileName: fileName || uploadedFile.originalname,
      fileSize: uploadedFile.size,
      mimeType: uploadedFile.mimetype,
      filePath: uploadedFile.filename // 存储文件路径
    };

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
      message: '文件上传成功'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('上传文件失败:', error);
    res.status(500).json({
      success: false,
      message: '上传文件失败'
    });
  }
});

/**
 * @swagger
 * /clipboard:
 *   post:
 *     tags: [Clipboard]
 *     summary: 上传剪切板内容
 *     description: |
 *       创建新的剪切板内容项，支持三种类型：
 *
 *       **1. 文本类型 (text)**
 *       - type: "text"
 *       - content: 纯文本内容
 *       - deviceId: 设备ID
 *
 *       **2. 图片类型 (image)**
 *       - type: "image"
 *       - content: Base64编码的图片数据（包含data:image/格式前缀）
 *       - deviceId: 设备ID
 *       - fileName: 图片文件名（可选）
 *       - fileSize: 文件大小（可选）
 *       - mimeType: MIME类型，如 "image/png"（可选）
 *
 *       **3. 文件类型 (file)**
 *       - type: "file"
 *       - content: Base64编码的文件数据
 *       - deviceId: 设备ID
 *       - fileName: 文件名（必需）
 *       - fileSize: 文件大小（可选）
 *       - mimeType: MIME类型，如 "text/plain", "application/pdf"（可选）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UploadRequest'
 *           examples:
 *             textExample:
 *               summary: 文本内容
 *               description: 上传纯文本内容
 *               value:
 *                 type: "text"
 *                 content: "这是一段文本内容"
 *                 deviceId: "device-001"
 *             imageExample:
 *               summary: 图片内容
 *               description: 上传图片内容（Base64编码）
 *               value:
 *                 type: "image"
 *                 content: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
 *                 deviceId: "device-001"
 *                 fileName: "screenshot.png"
 *                 fileSize: 1024
 *                 mimeType: "image/png"
 *             fileExample:
 *               summary: 文件内容
 *               description: 上传文件内容（Base64编码）
 *               value:
 *                 type: "file"
 *                 content: "SGVsbG8gV29ybGQh"
 *                 deviceId: "device-001"
 *                 fileName: "document.txt"
 *                 fileSize: 12
 *                 mimeType: "text/plain"
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
      filePath?: string;
    } = {
      id: uuidv4(),
      type,
      content,
      deviceId
    };

    // 如果是文件或图片类型，处理文件存储
    if (type === 'file' || type === 'image') {
      if (type === 'file' && !fileName) {
        return res.status(400).json({
          success: false,
          message: '文件类型需要提供文件名'
        });
      }

      // 如果content是base64数据，保存到临时目录
      if (content.startsWith('data:') || content.match(/^[A-Za-z0-9+/]+=*$/)) {
        try {
          const savedFileName = await saveFileFromBase64(content, fileName || 'file');
          newItemData.content = savedFileName; // 存储文件名作为内容标识
          newItemData.filePath = savedFileName; // 存储文件路径
        } catch (error) {
          console.error('保存base64文件失败:', error);
          return res.status(500).json({
            success: false,
            message: '保存文件失败'
          });
        }
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
 *   put:
 *     tags: [Clipboard]
 *     summary: 更新剪切板内容
 *     description: |
 *       更新指定的剪切板内容项。目前支持更新文本内容和文件名。
 *
 *       **支持的更新字段：**
 *       - content: 文本内容（仅限文本类型）
 *       - fileName: 文件名（仅限文件和图片类型）
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRequest'
 *     responses:
 *       200:
 *         description: 更新成功
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
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, fileName }: UpdateRequest = req.body;

    // 验证至少有一个字段需要更新
    if (content === undefined && fileName === undefined) {
      return res.status(400).json({
        success: false,
        message: '至少需要提供一个要更新的字段: content 或 fileName'
      });
    }

    // 先获取当前项目信息，验证类型
    const currentItem = await ClipboardItemDAO.getById(id);
    if (!currentItem) {
      return res.status(404).json({
        success: false,
        message: '未找到指定的剪切板内容'
      });
    }

    // 验证更新字段的合法性
    if (content !== undefined) {
      if (currentItem.type !== 'text') {
        return res.status(400).json({
          success: false,
          message: '只有文本类型的内容可以更新content字段'
        });
      }
      if (typeof content !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'content字段必须是字符串类型'
        });
      }
    }

    if (fileName !== undefined) {
      if (currentItem.type === 'text') {
        return res.status(400).json({
          success: false,
          message: '文本类型的内容不能更新fileName字段'
        });
      }
      if (typeof fileName !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'fileName字段必须是字符串类型'
        });
      }
    }

    // 执行更新
    const updatedItem = await ClipboardItemDAO.update(id, { content, fileName });

    if (!updatedItem) {
      return res.status(500).json({
        success: false,
        message: '更新失败'
      });
    }

    // 通过WebSocket广播更新消息
    const wsManager = getWebSocketManager();
    if (wsManager) {
      wsManager.broadcastNewItem(updatedItem);
    }

    const response: ApiResponse<ClipboardItem> = {
      success: true,
      data: updatedItem,
      message: '更新成功'
    };

    res.json(response);
  } catch (error) {
    console.error('更新剪切板内容失败:', error);
    res.status(500).json({
      success: false,
      message: '更新剪切板内容失败'
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