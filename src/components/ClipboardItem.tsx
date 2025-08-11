import { useState } from 'react';
import { Copy, Trash2, Image, FileText, File, Check, X, Download, Edit2, Save } from 'lucide-react';
import type { ClipboardItem as ClipboardItemType } from '../../shared/types';
import { getApiBaseUrl } from '../lib/config';
import SecureImage from './SecureImage';
import { apiClient } from '../lib/api';

interface ClipboardItemProps {
  item: ClipboardItemType;
  onDelete: (id: string) => void;
  onCopy: (content: string) => void;
  onUpdate?: (id: string, updates: { content?: string; fileName?: string }) => void;
}

export default function ClipboardItem({ item, onDelete, onCopy, onUpdate }: ClipboardItemProps) {
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(item.content);
  const [editFileName, setEditFileName] = useState(item.fileName || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleCopy = async () => {
    try {
      let copyContent = item.content;

      // 对于文件类型，复制文件名而不是文件路径
      if (item.type === 'file' && item.fileName) {
        copyContent = item.fileName;
      }
      // 对于图片类型，如果是新的文件存储方式，复制文件名
      else if (item.type === 'image' && item.filePath && item.fileName) {
        copyContent = item.fileName;
      }

      await navigator.clipboard.writeText(copyContent);
      onCopy(copyContent);
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

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(item.content);
    setEditFileName(item.fileName || '');
  };

  const handleSave = async () => {
    if (!onUpdate) return;

    setIsSaving(true);
    try {
      const updates: { content?: string; fileName?: string } = {};

      // 对于文本类型，更新内容
      if (item.type === 'text' && editContent !== item.content) {
        updates.content = editContent;
      }

      // 对于文件和图片类型，更新文件名
      if ((item.type === 'file' || item.type === 'image') && editFileName !== item.fileName) {
        updates.fileName = editFileName;
      }

      // 如果有更新内容，则调用更新函数
      if (Object.keys(updates).length > 0) {
        await onUpdate(item.id, updates);
      }

      setIsEditing(false);
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(item.content);
    setEditFileName(item.fileName || '');
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
            {/* 判断是否是新的文件存储方式（有filePath）还是旧的base64方式 */}
            {item.filePath ? (
              <SecureImage
                fileId={item.id}
                alt="剪切板图片"
                className="max-w-full max-h-32 rounded-lg object-contain"
                fileName={item.fileName}
              />
            ) : (
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
            )}
            <div className="text-xs text-gray-400 mt-2 italic">
              💡 右键点击图片进行复制
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
                {isEditing ? (
                  <div className="flex-1 mr-2">
                    <input
                      type="text"
                      value={editFileName}
                      onChange={(e) => setEditFileName(e.target.value)}
                      className="w-full p-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="文件名"
                      disabled={isSaving}
                    />
                  </div>
                ) : (
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {item.fileName || '未知文件'}
                  </h4>
                )}
                <button
                  onClick={async () => {
                    try {
                      // 判断是否是新的文件存储方式（有filePath）还是旧的base64方式
                      if (item.filePath) {
                        // 使用安全的API请求下载文件
                        const blob = await apiClient.getFileDownload(item.id, item.fileName);
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = item.fileName || 'download';
                        link.click();
                        // 清理blob URL
                        URL.revokeObjectURL(url);
                      } else {
                        // 旧的base64方式
                        const link = document.createElement('a');
                        link.href = item.content;
                        link.download = item.fileName || 'download';
                        link.click();
                      }
                    } catch (error) {
                      console.error('文件下载失败:', error);
                      alert('文件下载失败，请重试');
                    }
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
              {isEditing && (
                <div className="flex items-center space-x-2 mt-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSaving ? '保存中...' : '保存'}</span>
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-3 py-1 text-xs bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    取消
                  </button>
                </div>
              )}
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
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={Math.min(10, Math.max(3, editContent.split('\n').length))}
                placeholder="输入文本内容..."
                disabled={isSaving}
              />
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSaving ? '保存中...' : '保存'}</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-900 break-words whitespace-pre-wrap">
              {item.content.length > 200
                ? `${item.content.substring(0, 200)}...`
                : item.content
              }
            </p>
          )}
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
          {/* 编辑按钮 */}
          {onUpdate && !isEditing && (
            <button
              onClick={handleEdit}
              className="p-1.5 rounded-md hover:bg-blue-100 text-gray-600 hover:text-blue-600 transition-colors duration-200"
              title={item.type === 'text' ? '编辑文本内容' : '编辑文件名'}
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

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