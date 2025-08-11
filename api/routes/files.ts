import express, { Request, Response } from 'express';
import path from 'path';
import { ClipboardItemDAO } from '../database.js';
import { readFile, fileExists, getFilePath } from '../utils/fileStorage.js';
import { performFullFileCleanup, fileCleanupScheduler } from '../utils/fileCleanup.js';
import type { ApiResponse } from '../types/shared';

const router: express.Router = express.Router();

/**
 * @swagger
 * /files/{id}:
 *   get:
 *     tags: [Files]
 *     summary: 下载文件
 *     description: 根据剪切板项目ID下载对应的文件
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 剪切板项目ID
 *     responses:
 *       200:
 *         description: 文件下载成功
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: 文件未找到
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

    // 从数据库获取剪切板项目
    const item = await ClipboardItemDAO.getById(id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '未找到指定的剪切板内容'
      });
    }

    // 检查是否是文件类型
    if (item.type !== 'file' && item.type !== 'image') {
      return res.status(400).json({
        success: false,
        message: '该内容不是文件类型'
      });
    }

    // 检查是否有文件路径
    if (!item.filePath) {
      return res.status(404).json({
        success: false,
        message: '文件路径不存在'
      });
    }

    // 检查文件是否存在
    const exists = await fileExists(item.filePath);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    try {
      // 读取文件
      const fileBuffer = await readFile(item.filePath);
      
      // 设置响应头
      res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.fileName || 'download')}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      
      // 发送文件
      res.send(fileBuffer);
    } catch (error) {
      console.error('读取文件失败:', error);
      return res.status(500).json({
        success: false,
        message: '读取文件失败'
      });
    }
  } catch (error) {
    console.error('下载文件失败:', error);
    res.status(500).json({
      success: false,
      message: '下载文件失败'
    });
  }
});

/**
 * @swagger
 * /files/{id}/preview:
 *   get:
 *     tags: [Files]
 *     summary: 预览文件
 *     description: 根据剪切板项目ID预览对应的文件（内联显示）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 剪切板项目ID
 *     responses:
 *       200:
 *         description: 文件预览成功
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: 文件未找到
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
router.get('/:id/preview', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 从数据库获取剪切板项目
    const item = await ClipboardItemDAO.getById(id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: '未找到指定的剪切板内容'
      });
    }

    // 检查是否是文件类型
    if (item.type !== 'file' && item.type !== 'image') {
      return res.status(400).json({
        success: false,
        message: '该内容不是文件类型'
      });
    }

    // 检查是否有文件路径
    if (!item.filePath) {
      return res.status(404).json({
        success: false,
        message: '文件路径不存在'
      });
    }

    // 检查文件是否存在
    const exists = await fileExists(item.filePath);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    try {
      // 读取文件
      const fileBuffer = await readFile(item.filePath);
      
      // 设置响应头（内联显示）
      res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.fileName || 'preview')}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      
      // 发送文件
      res.send(fileBuffer);
    } catch (error) {
      console.error('读取文件失败:', error);
      return res.status(500).json({
        success: false,
        message: '读取文件失败'
      });
    }
  } catch (error) {
    console.error('预览文件失败:', error);
    res.status(500).json({
      success: false,
      message: '预览文件失败'
    });
  }
});

/**
 * @swagger
 * /files/stats:
 *   get:
 *     tags: [Files]
 *     summary: 获取文件存储统计信息
 *     description: 获取文件存储的统计信息，包括文件数量、总大小等
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
 *                       type: object
 *                       properties:
 *                         totalFiles:
 *                           type: number
 *                           description: 总文件数量
 *                         totalSize:
 *                           type: number
 *                           description: 总文件大小（字节）
 *                         directorySize:
 *                           type: number
 *                           description: 存储目录大小（字节）
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // 获取数据库中的文件统计
    const stats = await ClipboardItemDAO.getStats();
    
    // 获取实际存储目录大小
    const { getDirectorySize, listFiles } = await import('../utils/fileStorage.js');
    const directorySize = await getDirectorySize();
    const fileList = await listFiles();
    
    const response: ApiResponse<{
      totalFiles: number;
      totalSize: number;
      directorySize: number;
      fileCount: number;
    }> = {
      success: true,
      data: {
        totalFiles: stats.fileItems + stats.imageItems,
        totalSize: stats.totalSize,
        directorySize: directorySize,
        fileCount: fileList.length
      }
    };

    res.json(response);
  } catch (error) {
    console.error('获取文件统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文件统计失败'
    });
  }
});

/**
 * @swagger
 * /files/cleanup:
 *   post:
 *     tags: [Files]
 *     summary: 手动触发文件清理
 *     description: 手动触发文件清理任务，清理孤立文件和缺失文件的记录
 *     responses:
 *       200:
 *         description: 清理成功
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         orphanedFiles:
 *                           type: object
 *                           properties:
 *                             deletedCount:
 *                               type: number
 *                               description: 删除的孤立文件数量
 *                             totalFiles:
 *                               type: number
 *                               description: 总文件数量
 *                             validFiles:
 *                               type: number
 *                               description: 有效文件数量
 *                         missingRecords:
 *                           type: object
 *                           properties:
 *                             deletedRecords:
 *                               type: number
 *                               description: 删除的缺失文件记录数量
 *                             checkedRecords:
 *                               type: number
 *                               description: 检查的记录数量
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    console.log('手动触发文件清理...');
    const result = await performFullFileCleanup();

    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      message: '文件清理完成'
    };

    res.json(response);
  } catch (error) {
    console.error('文件清理失败:', error);
    res.status(500).json({
      success: false,
      message: '文件清理失败'
    });
  }
});

/**
 * @swagger
 * /files/cleanup/status:
 *   get:
 *     tags: [Files]
 *     summary: 获取文件清理任务状态
 *     description: 获取文件清理调度器的当前状态
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
 *                       type: object
 *                       properties:
 *                         isScheduled:
 *                           type: boolean
 *                           description: 是否已调度
 *                         isRunning:
 *                           type: boolean
 *                           description: 是否正在运行
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/cleanup/status', async (req: Request, res: Response) => {
  try {
    const status = fileCleanupScheduler.getStatus();

    const response: ApiResponse<typeof status> = {
      success: true,
      data: status
    };

    res.json(response);
  } catch (error) {
    console.error('获取清理状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取清理状态失败'
    });
  }
});

export default router;
