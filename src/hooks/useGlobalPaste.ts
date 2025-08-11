import { useEffect, useCallback, useState } from 'react';
import { apiClient } from '../lib/api';
import { deviceId } from '../lib/websocket';
import type { ClipboardItem } from '../../shared/types';

interface PasteResult {
  success: boolean;
  item?: ClipboardItem;
  error?: string;
}

interface UseGlobalPasteOptions {
  enabled?: boolean;
  onPasteStart?: () => void;
  onPasteComplete?: (result: PasteResult) => void;
  onPasteError?: (error: string) => void;
}

export function useGlobalPaste(options: UseGlobalPasteOptions = {}) {
  const { enabled = true, onPasteStart, onPasteComplete, onPasteError } = options;
  const [isPasting, setIsPasting] = useState(false);
  const [lastPasteResult, setLastPasteResult] = useState<PasteResult | null>(null);

  // 处理粘贴事件
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    // 检查是否在输入框中，如果是则不处理
    const target = event.target as HTMLElement;
    if (target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true' ||
      target.closest('input, textarea, [contenteditable="true"]')
    )) {
      return;
    }

    // 阻止默认行为
    event.preventDefault();

    if (isPasting) {
      return;
    }

    setIsPasting(true);
    onPasteStart?.();

    try {
      const clipboardItems = await navigator.clipboard.read();
      
      if (clipboardItems.length === 0) {
        throw new Error('剪切板为空');
      }

      let uploadData: {
        type: 'text' | 'image' | 'file';
        content: string;
        deviceId: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      } | null = null;

      // 处理剪切板内容
      for (const clipboardItem of clipboardItems) {
        // 优先处理图片
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            
            // 检查文件大小 (限制为5MB)
            if (blob.size > 5 * 1024 * 1024) {
              throw new Error('图片文件大小不能超过5MB');
            }

            // 转换为base64
            const reader = new FileReader();
            const base64Content = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            uploadData = {
              type: 'image',
              content: base64Content,
              deviceId,
              fileName: `clipboard-image-${Date.now()}.${type.split('/')[1]}`,
              fileSize: blob.size,
              mimeType: type
            };
            break;
          }
        }

        // 如果没有图片，处理文字
        if (!uploadData && clipboardItem.types.includes('text/plain')) {
          const text = await navigator.clipboard.readText();
          if (text.trim()) {
            uploadData = {
              type: 'text',
              content: text.trim(),
              deviceId
            };
          }
        }

        // 如果找到了内容就跳出循环
        if (uploadData) {
          break;
        }
      }

      if (!uploadData) {
        throw new Error('剪切板中没有可用的内容');
      }

      // 上传到服务器
      const item = await apiClient.createClipboardItem(uploadData);

      const result: PasteResult = {
        success: true,
        item
      };

      setLastPasteResult(result);
      onPasteComplete?.(result);

    } catch (error) {
      console.error('全局粘贴失败:', error);
      const errorMessage = error instanceof Error ? error.message : '粘贴失败，请重试';
      
      const result: PasteResult = {
        success: false,
        error: errorMessage
      };

      setLastPasteResult(result);
      onPasteError?.(errorMessage);
      onPasteComplete?.(result);
    } finally {
      setIsPasting(false);
    }
  }, [isPasting, onPasteStart, onPasteComplete, onPasteError]);

  // 注册全局粘贴事件监听器
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 检查浏览器是否支持 Clipboard API
    if (!navigator.clipboard || !navigator.clipboard.read) {
      console.warn('浏览器不支持 Clipboard API');
      return;
    }

    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [enabled, handlePaste]);

  // 清除上次粘贴结果
  const clearLastResult = useCallback(() => {
    setLastPasteResult(null);
  }, []);

  return {
    isPasting,
    lastPasteResult,
    clearLastResult
  };
}
