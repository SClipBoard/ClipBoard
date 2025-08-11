import { useEffect, useState } from 'react';
import { Check, AlertCircle, Upload, X } from 'lucide-react';
import type { ClipboardItem } from '../../shared/types';

interface PasteResult {
  success: boolean;
  item?: ClipboardItem;
  error?: string;
}

interface GlobalPasteIndicatorProps {
  isPasting: boolean;
  lastPasteResult: PasteResult | null;
  onClearResult: () => void;
}

export default function GlobalPasteIndicator({
  isPasting,
  lastPasteResult,
  onClearResult
}: GlobalPasteIndicatorProps) {
  const [showResult, setShowResult] = useState(false);

  // 当有新的粘贴结果时显示
  useEffect(() => {
    if (lastPasteResult) {
      setShowResult(true);
      
      // 成功的结果3秒后自动隐藏，失败的结果5秒后自动隐藏
      const timeout = setTimeout(() => {
        setShowResult(false);
        setTimeout(onClearResult, 300); // 等待动画完成后清除结果
      }, lastPasteResult.success ? 3000 : 5000);

      return () => clearTimeout(timeout);
    }
  }, [lastPasteResult, onClearResult]);

  // 如果正在粘贴，显示加载状态
  if (isPasting) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg animate-in duration-300">
        <div className="flex items-center space-x-3">
          <Upload className="w-5 h-5 text-blue-600 animate-pulse" />
          <div>
            <p className="font-medium text-blue-800">正在上传剪切板内容...</p>
            <p className="text-sm text-blue-600">请稍候</p>
          </div>
        </div>
      </div>
    );
  }

  // 如果有结果且需要显示，显示结果状态
  if (lastPasteResult && showResult) {
    return (
      <div className={`fixed top-4 right-4 z-50 rounded-lg p-4 shadow-lg transition-all duration-300 ${
        lastPasteResult.success
          ? 'bg-green-50 border border-green-200'
          : 'bg-red-50 border border-red-200'
      } ${showResult ? 'animate-in opacity-100 translate-y-0' : 'animate-out opacity-0 -translate-y-2'}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            {lastPasteResult.success ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-medium ${
              lastPasteResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {lastPasteResult.success ? '粘贴上传成功！' : '粘贴上传失败'}
            </p>
            {lastPasteResult.success && lastPasteResult.item ? (
              <div className="mt-1 text-sm text-green-600">
                <p>类型: {getTypeDisplayName(lastPasteResult.item.type)}</p>
                {lastPasteResult.item.type === 'text' && (
                  <p className="truncate max-w-xs">
                    内容: {lastPasteResult.item.content.substring(0, 50)}
                    {lastPasteResult.item.content.length > 50 ? '...' : ''}
                  </p>
                )}
                {lastPasteResult.item.type === 'image' && (
                  <p>图片已成功上传到剪切板</p>
                )}
                {lastPasteResult.item.type === 'file' && lastPasteResult.item.fileName && (
                  <p className="truncate max-w-xs">文件: {lastPasteResult.item.fileName}</p>
                )}
              </div>
            ) : lastPasteResult.error && (
              <p className="mt-1 text-sm text-red-600">
                {lastPasteResult.error}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setShowResult(false);
              setTimeout(onClearResult, 300);
            }}
            className={`flex-shrink-0 p-1 rounded-full transition-colors ${
              lastPasteResult.success
                ? 'hover:bg-green-100 text-green-600'
                : 'hover:bg-red-100 text-red-600'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function getTypeDisplayName(type: string): string {
  switch (type) {
    case 'text':
      return '文字';
    case 'image':
      return '图片';
    case 'file':
      return '文件';
    default:
      return type;
  }
}
