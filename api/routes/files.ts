import express, { Request, Response } from 'express';
import path from 'path';
import { ClipboardItemDAO } from '../database.js';
import { readFile, fileExists, getFilePath } from '../utils/fileStorage.js';
import { performFullFileCleanup, fileCleanupScheduler } from '../utils/fileCleanup.js';
import type { ApiResponse } from '../types/shared';

const router: express.Router = express.Router();

/**
 * 生成符合RFC 5987标准的Content-Disposition头，正确处理中文文件名
 */
function generateContentDisposition(type: 'inline' | 'attachment', fileName: string): string {
  // 对文件名进行URL编码
  const encodedFileName = encodeURIComponent(fileName);

  // 检查文件名是否包含非ASCII字符
  const hasNonAscii = /[^\x00-\x7F]/.test(fileName);

  if (hasNonAscii) {
    // 如果包含非ASCII字符，只使用RFC 5987格式
    return `${type}; filename*=UTF-8''${encodedFileName}`;
  } else {
    // 如果只包含ASCII字符，使用标准格式
    return `${type}; filename="${fileName}"`;
  }
}

// 添加中间件来记录所有到达文件路由的请求
router.use((req, res, next) => {
  next();
});

/**
 * @swagger
 * /files/preview:
 *   get:
 *     tags: [Files]
 *     summary: 预览文件（查询参数版本，支持安全请求头）
 *     description: |
 *       根据查询参数中的ID预览对应的文件，支持传递文件名。
 *
 *       **安全功能：**
 *       - 支持自定义安全请求头验证
 *       - 前端会自动附加用户在设置中配置的安全请求头
 *       - 可配合nginx等反向代理进行访问控制
 *
 *       **使用方式：**
 *       1. 在前端设置页面配置安全请求头（如：X-API-Key）
 *       2. 前端组件会自动使用此接口并附加安全请求头
 *       3. 服务器返回文件内容供前端显示
 *     security:
 *       - CustomHeader: []
 *     parameters:
 *       - $ref: '#/components/parameters/FileIdQueryParam'
 *       - $ref: '#/components/parameters/FileNameQueryParam'
 *     responses:
 *       200:
 *         description: 文件预览成功
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *             example: "二进制图片数据"
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "缺少必需的参数: id"
 *       404:
 *         description: 文件未找到
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "未找到指定的剪切板内容"
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/preview', async (req: Request, res: Response) => {
  try {
    const { id, name } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: '缺少必需的参数: id'
      });
    }

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

      // 使用传递的文件名或者数据库中的文件名
      const fileName = (typeof name === 'string' && name.trim()) ? name.trim() : (item.fileName || 'preview');

      // 设置响应头（内联显示）
      res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', generateContentDisposition('inline', fileName));
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
 * /files/download:
 *   get:
 *     tags: [Files]
 *     summary: 下载文件（查询参数版本，支持安全请求头）
 *     description: |
 *       根据查询参数中的ID下载对应的文件，支持传递文件名。
 *
 *       **安全功能：**
 *       - 支持自定义安全请求头验证
 *       - 前端会自动附加用户在设置中配置的安全请求头
 *       - 可配合nginx等反向代理进行访问控制
 *
 *       **使用方式：**
 *       1. 在前端设置页面配置安全请求头（如：X-API-Key）
 *       2. 前端组件会自动使用此接口并附加安全请求头
 *       3. 服务器返回文件内容供用户下载
 *
 *       **响应头说明：**
 *       - Content-Type: 文件的MIME类型
 *       - Content-Disposition: attachment; filename="文件名"
 *       - Content-Length: 文件大小
 *     security:
 *       - CustomHeader: []
 *     parameters:
 *       - $ref: '#/components/parameters/FileIdQueryParam'
 *       - $ref: '#/components/parameters/FileNameQueryParam'
 *     responses:
 *       200:
 *         description: 文件下载成功
 *         headers:
 *           Content-Type:
 *             description: 文件的MIME类型
 *             schema:
 *               type: string
 *               example: "application/pdf"
 *           Content-Disposition:
 *             description: 文件下载配置
 *             schema:
 *               type: string
 *               example: 'attachment; filename="document.pdf"'
 *           Content-Length:
 *             description: 文件大小（字节）
 *             schema:
 *               type: integer
 *               example: 1024
 *         content:
 *           application/octet-stream:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "缺少必需的参数: id"
 *       404:
 *         description: 文件未找到
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               message: "未找到指定的剪切板内容"
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/download', async (req: Request, res: Response) => {
  try {
    console.log('下载路由被调用，查询参数:', req.query);
    const { id, name } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: '缺少必需的参数: id'
      });
    }

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

      // 使用传递的文件名或者数据库中的文件名
      const fileName = (typeof name === 'string' && name.trim()) ? name.trim() : (item.fileName || 'download');

      // 设置响应头（下载）
      res.setHeader('Content-Type', item.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', generateContentDisposition('attachment', fileName));
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
 * /files/{id}:
 *   get:
 *     tags: [Files]
 *     summary: 下载文件（传统路径参数版本）
 *     description: |
 *       根据剪切板项目ID下载对应的文件。这是传统的路径参数版本。
 *
 *       **注意：** 推荐使用新的查询参数版本 `/files/download?id=xxx&name=xxx`，
 *       该版本支持安全请求头和文件名参数。
 *
 *       **限制：**
 *       - 不支持自定义安全请求头
 *       - 不支持自定义文件名参数
 *       - 主要用于向后兼容
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
      const fileName = item.fileName || 'download';
      res.setHeader('Content-Disposition', generateContentDisposition('attachment', fileName));
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
 *     summary: 预览文件（传统路径参数版本）
 *     description: |
 *       根据剪切板项目ID预览对应的文件（内联显示）。这是传统的路径参数版本。
 *
 *       **注意：** 推荐使用新的查询参数版本 `/files/preview?id=xxx&name=xxx`，
 *       该版本支持安全请求头和文件名参数。
 *
 *       **限制：**
 *       - 不支持自定义安全请求头
 *       - 不支持自定义文件名参数
 *       - 主要用于向后兼容
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
      const fileName = item.fileName || 'preview';
      res.setHeader('Content-Disposition', generateContentDisposition('inline', fileName));
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
