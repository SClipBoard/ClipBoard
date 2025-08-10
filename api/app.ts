/**
 * This is a API server
 */

import express, { type Request, type Response, type NextFunction }  from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import authRoutes from './routes/auth.js';
import clipboardRoutes from './routes/clipboard.js';
import devicesRoutes from './routes/devices.js';
import configRoutes from './routes/config.js';

// for esm mode
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load env
dotenv.config();


const app: express.Application = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务 - 服务前端打包后的文件
app.use(express.static(path.join(__dirname, '../')));

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/clipboard', clipboardRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/config', configRoutes);

/**
 * health
 */
app.use('/api/health', (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'ok'
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