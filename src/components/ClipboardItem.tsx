import { useState } from 'react';
import { Copy, Trash2, Image, FileText, File, Check, X, Download } from 'lucide-react';
import type { ClipboardItem as ClipboardItemType } from '../../shared/types';

interface ClipboardItemProps {
  item: ClipboardItemType;
  onDelete: (id: string) => void;
  onCopy: (content: string) => void;
}

export default function ClipboardItem({ item, onDelete, onCopy }: ClipboardItemProps) {
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.content);
      onCopy(item.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const handleDelete = () => {
    onDelete(item.id);
    setShowDeleteConfirm(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderContent = () => {
    if (item.type === 'image') {
      return (
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Image className="w-8 h-8 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <img 
              src={item.content} 
              alt="剪切板图片" 
              className="max-w-full max-h-32 rounded-lg object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="hidden text-sm text-gray-500 mt-2">
              图片加载失败
            </div>
          </div>
        </div>
      );
    }

    if (item.type === 'file') {
      const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return (
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-1">
            <File className="w-5 h-5 text-purple-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {item.fileName || '未知文件'}
                </h4>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = item.content;
                    link.download = item.fileName || 'download';
                    link.click();
                  }}
                  className="p-1 rounded-md hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                  title="下载文件"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span>大小: {item.fileSize ? formatFileSize(item.fileSize) : '未知'}</span>
                <span>类型: {item.mimeType || '未知'}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-1">
          <FileText className="w-5 h-5 text-green-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 break-words whitespace-pre-wrap">
            {item.content.length > 200 
              ? `${item.content.substring(0, 200)}...` 
              : item.content
            }
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200">
      {/* 内容区域 */}
      <div className="mb-3">
        {renderContent()}
      </div>

      {/* 元信息和操作按钮 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-2">
          <span>来自: {item.deviceId}</span>
          <span>•</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 复制按钮 */}
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-md transition-colors duration-200 ${
              copied 
                ? 'bg-green-100 text-green-600' 
                : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="复制到剪切板"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* 删除按钮 */}
          {showDeleteConfirm ? (
            <div className="flex items-center space-x-1">
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition-colors duration-200"
                title="确认删除"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="p-1.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors duration-200"
                title="取消删除"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-md hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors duration-200"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}