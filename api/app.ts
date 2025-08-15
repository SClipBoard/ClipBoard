/**
 * This is a API server
 */

import express, { type Request, type Response, type NextFunction }  from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

import clipboardRoutes from './routes/clipboard.js';
import devicesRoutes from './routes/devices.js';
import configRoutes from './routes/config.js';
import filesRoutes from './routes/files.js';
import websocketDocsRoutes from './routes/websocket-docs.js';
import { setupSwagger } from './swagger.js';

// for esm mode
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load env
dotenv.config();


const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '50gb' })); // 移除实际限制，设置一个很大的值
app.use(express.urlencoded({ extended: true, limit: '50gb' }));

// 设置字符编码处理
app.use((req, res, next) => {
  // 只为JSON响应设置字符编码，避免影响文件下载和 Swagger UI
  if (req.path.startsWith('/api/') &&
      !req.path.includes('/files/') &&
      !req.path.includes('/docs')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  next();
});

/**
 * API 文档 - 需要在静态文件服务之前设置
 */
setupSwagger(app);

// 静态文件服务 - 服务前端打包后的文件
app.use(express.static(path.join(__dirname, '../')));

/**
 * API Routes
 */

app.use('/api/clipboard', clipboardRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/config', configRoutes);
app.use('/api/files', filesRoutes);
// WebSocket文档路由（仅用于Swagger文档生成）
app.use('/api', websocketDocsRoutes);

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: 健康检查
 *     description: 检查服务器是否正常运行
 *     responses:
 *       200:
 *         description: 服务器正常运行
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: 'ok'
 */
app.use('/api/health', (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'ok'
  });
});

// 调试路由 - 检查 Swagger 配置
app.get('/api/debug/swagger', (req: Request, res: Response): void => {
  res.json({
    success: true,
    message: 'Swagger 调试信息',
    data: {
      swaggerUiVersion: require('swagger-ui-express/package.json').version,
      swaggerJsdocVersion: require('swagger-jsdoc/package.json').version,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * error handler middleware
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    error: 'Server internal error'
  });
});

/**
 * SPA fallback - 对于非API路由，返回index.html
 */
app.get('*', (req: Request, res: Response) => {
  // 如果是API路由但没有匹配到，返回404 JSON
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API not found'
    });
  } else {
    // 对于其他路由，返回前端应用的index.html
    res.sendFile(path.join(__dirname, '../index.html'));
  }
});

export default app;