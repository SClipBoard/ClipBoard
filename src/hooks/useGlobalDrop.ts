import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { deviceId } from '../lib/websocket';
import type { ClipboardItem } from '../../shared/types';

interface DropResult {
  success: boolean;
  item?: ClipboardItem;
  error?: string;
}

interface UseGlobalDropOptions {
  enabled?: boolean;
  onDropComplete?: (result: DropResult) => void;
}

export function useGlobalDrop(options: UseGlobalDropOptions = {}) {
  const { enabled = true, onDropComplete } = options;
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastDropResult, setLastDropResult] = useState<DropResult | null>(null);
  const [dragCounter, setDragCounter] = useState(0);

  // 处理文件上传
  const uploadFile = useCallback(async (file: File): Promise<DropResult> => {
    try {
      setIsUploading(true);
      
      // 判断文件类型
      const isImage = file.type.startsWith('image/');
      const type = isImage ? 'image' : 'file';
      
      const item = await apiClient.uploadFile(file, type, deviceId);
      
      const result: DropResult = {
        success: true,
        item
      };
      
      setLastDropResult(result);
      onDropComplete?.(result);
      
      return result;
    } catch (error) {
      console.error('文件上传失败:', error);
      const result: DropResult = {
        success: false,
        error: error instanceof Error ? error.message : '文件上传失败，请重试'
      };
      
      setLastDropResult(result);
      onDropComplete?.(result);
      
      return result;
    } finally {
      setIsUploading(false);
    }
  }, [onDropComplete]);

  // 处理拖拽进入
  const handleDragEnter = useCallback((e: DragEvent) => {
    if (!enabled) return;

    e.preventDefault();
    e.stopPropagation();

    // 检查是否包含文件
    if (e.dataTransfer?.types.includes('Files')) {
      setDragCounter(prev => prev + 1);
      setIsDragging(true);
    }
  }, [enabled]);

  // 处理拖拽经过
  const handleDragOver = useCallback((e: DragEvent) => {
    if (!enabled) return;
    
    e.preventDefault();
    e.stopPropagation();
  }, [enabled]);

  // 处理拖拽离开
  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!enabled) return;

    e.preventDefault();
    e.stopPropagation();

    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsDragging(false);
        return 0;
      }
      return newCount;
    });
  }, [enabled]);

  // 处理文件放置
  const handleDrop = useCallback(async (e: DragEvent) => {
    if (!enabled) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    // 只处理第一个文件
    const file = files[0];
    await uploadFile(file);
  }, [enabled, uploadFile]);

  // 清除上次的结果
  const clearLastResult = useCallback(() => {
    setLastDropResult(null);
  }, []);

  // 绑定全局事件监听器
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  }, [enabled, handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

  return {
    isDragging,
    isUploading,
    lastDropResult,
    clearLastResult,
    uploadFile
  };
}
