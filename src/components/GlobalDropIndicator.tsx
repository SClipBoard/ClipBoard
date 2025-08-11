import { Upload, Image, File, Check, AlertCircle, X } from 'lucide-react';

interface DropResult {
  success: boolean;
  item?: {
    id: string;
    type: string;
    fileName?: string;
  };
  error?: string;
}

interface GlobalDropIndicatorProps {
  isDragging: boolean;
  isUploading: boolean;
  lastDropResult: DropResult | null;
  onClearResult: () => void;
}

export default function GlobalDropIndicator({
  isDragging,
  isUploading,
  lastDropResult,
  onClearResult
}: GlobalDropIndicatorProps) {
  // 拖拽指示器
  if (isDragging) {
    return (
      <div className="fixed inset-0 z-50 bg-blue-500 bg-opacity-20 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 border-4 border-blue-500 border-dashed">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              拖拽文件到此处
            </h3>
            <p className="text-gray-600 mb-4">
              支持图片、文档、视频、音频等所有格式
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Image className="w-4 h-4" />
                <span>图片</span>
              </div>
              <div className="flex items-center space-x-1">
                <File className="w-4 h-4" />
                <span>文件</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 上传中指示器
  if (isUploading) {
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <Upload className="w-6 h-6 text-blue-600 animate-bounce" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              正在上传文件...
            </h3>
            <p className="text-gray-600">
              请稍候，文件正在上传到共享剪切板
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 上传结果指示器
  if (lastDropResult) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className={`rounded-lg shadow-lg p-4 max-w-sm ${
          lastDropResult.success
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {lastDropResult.success ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-sm font-medium ${
                lastDropResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {lastDropResult.success ? '文件上传成功！' : '文件上传失败'}
              </h4>
              {lastDropResult.success && lastDropResult.item && (
                <p className="text-sm text-green-600 mt-1">
                  {lastDropResult.item.fileName || '文件'} 已添加到共享剪切板
                </p>
              )}
              {lastDropResult.error && (
                <p className="text-sm text-red-600 mt-1">
                  {lastDropResult.error}
                </p>
              )}
            </div>
            <button
              onClick={onClearResult}
              className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
