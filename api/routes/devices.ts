import express, { Request, Response } from 'express';
import type { Device, ApiResponse } from '../../shared/types.js';
import { DeviceDAO } from '../database.js';

const router = express.Router();

/**
 * 获取设备列表
 * GET /api/devices
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const devices = await DeviceDAO.getAll();

    const response: ApiResponse<Device[]> = {
      success: true,
      data: devices,
      total: devices.length
    };

    res.json(response);
  } catch (error) {
    console.error('获取设备列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备列表失败'
    });
  }
});

/**
 * 注册或更新设备信息
 * POST /api/devices
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { deviceId, deviceName, userAgent } = req.body;

    if (!deviceId || !deviceName) {
      return res.status(400).json({
        success: false,
        message: '缺少必需字段: deviceId, deviceName'
      });
    }

    // 使用upsert方法创建或更新设备
    const device = await DeviceDAO.upsert({
      deviceId,
      deviceName,
      userAgent,
      isConnected: true
    });

    const response: ApiResponse<Device> = {
      success: true,
      data: device,
      message: '设备注册成功'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('注册设备失败:', error);
    res.status(500).json({
      success: false,
      message: '注册设备失败'
    });
  }
});

/**
 * 更新设备连接状态
 * PUT /api/devices/:deviceId/status
 */
router.put('/:deviceId/status', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { isConnected } = req.body;

    const updatedDevice = await DeviceDAO.updateConnectionStatus(deviceId, isConnected);
    
    if (!updatedDevice) {
      return res.status(404).json({
        success: false,
        message: '未找到指定设备'
      });
    }

    const response: ApiResponse<Device> = {
      success: true,
      data: updatedDevice,
      message: '设备状态更新成功'
    };

    res.json(response);
  } catch (error) {
    console.error('更新设备状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新设备状态失败'
    });
  }
});

/**
 * 删除设备
 * DELETE /api/devices/:deviceId
 */
router.delete('/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const deleted = await DeviceDAO.delete(deviceId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: '未找到指定设备'
      });
    }

    const response: ApiResponse<null> = {
      success: true,
      message: '设备删除成功'
    };

    res.json(response);
  } catch (error) {
    console.error('删除设备失败:', error);
    res.status(500).json({
      success: false,
      message: '删除设备失败'
    });
  }
});

/**
 * 获取单个设备信息
 * GET /api/devices/:deviceId
 */
router.get('/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const device = await DeviceDAO.getById(deviceId);
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: '未找到指定设备'
      });
    }

    const response: ApiResponse<Device> = {
      success: true,
      data: device
    };

    res.json(response);
  } catch (error) {
    console.error('获取设备信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备信息失败'
    });
  }
});

export default router;