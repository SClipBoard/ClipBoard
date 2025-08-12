/**
 * 兼容性复制到剪切板工具函数
 * 支持现代 Clipboard API 和传统的 document.execCommand 降级方案
 */

export interface CopyResult {
  success: boolean;
  error?: string;
}

/**
 * 检查是否支持现代 Clipboard API
 */
export function isClipboardAPISupported(): boolean {
  return !!(navigator.clipboard && navigator.clipboard.writeText);
}

/**
 * 使用传统方法复制文本到剪切板
 * @param text 要复制的文本
 * @returns 是否成功
 */
function fallbackCopyToClipboard(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 设置样式使其不可见
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    textArea.style.zIndex = '-1';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      console.error('execCommand copy 失败:', err);
      return false;
    }
  } catch (error) {
    console.error('创建临时文本区域失败:', error);
    return false;
  }
}

/**
 * 复制文本到剪切板（兼容性版本）
 * @param text 要复制的文本
 * @returns Promise<CopyResult> 复制结果
 */
export async function copyToClipboard(text: string): Promise<CopyResult> {
  if (!text) {
    return {
      success: false,
      error: '复制内容不能为空'
    };
  }

  try {
    // 优先使用现代 Clipboard API
    if (isClipboardAPISupported()) {
      await navigator.clipboard.writeText(text);
      return { success: true };
    }
    
    // 降级方案：使用传统的 document.execCommand
    const success = fallbackCopyToClipboard(text);
    
    if (success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: '复制功能不可用，请手动复制内容'
      };
    }
  } catch (error) {
    console.error('复制操作失败:', error);
    
    // 如果现代API失败，尝试降级方案
    if (isClipboardAPISupported()) {
      const fallbackSuccess = fallbackCopyToClipboard(text);
      if (fallbackSuccess) {
        return { success: true };
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '复制操作失败'
    };
  }
}

/**
 * 复制文本到剪切板，并提供用户友好的错误处理
 * @param text 要复制的文本
 * @param options 选项
 * @returns Promise<boolean> 是否成功
 */
export async function copyWithFallback(
  text: string, 
  options: {
    showAlert?: boolean;
    maxPreviewLength?: number;
  } = {}
): Promise<boolean> {
  const { showAlert = true, maxPreviewLength = 100 } = options;
  
  const result = await copyToClipboard(text);
  
  if (result.success) {
    return true;
  }
  
  // 如果复制失败且允许显示提示
  if (showAlert) {
    const preview = text.length > maxPreviewLength 
      ? text.substring(0, maxPreviewLength) + '...' 
      : text;
      
    const userConfirmed = window.confirm(
      `复制功能不可用，是否显示内容以便手动复制？\n\n内容预览：${preview}`
    );
    
    if (userConfirmed) {
      alert(`请手动复制以下内容：\n\n${text}`);
    }
  }
  
  return false;
}

/**
 * 检查浏览器环境是否支持剪切板操作
 */
export function getClipboardSupport() {
  const hasClipboardAPI = isClipboardAPISupported();
  const hasExecCommand = document.queryCommandSupported && document.queryCommandSupported('copy');
  
  return {
    modern: hasClipboardAPI,
    legacy: hasExecCommand,
    supported: hasClipboardAPI || hasExecCommand
  };
}
