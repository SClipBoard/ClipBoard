import { useState } from 'react';
import { Trash2, FileText, Settings } from 'lucide-react';
import { apiClient } from '../lib/api';

interface FileCleanupTestProps {
  onClose: () => void;
}

export default function FileCleanupTest({ onClose }: FileCleanupTestProps) {
  const [maxFileCount, setMaxFileCount] = useState(10);
  const [strategy, setStrategy] = useState<'oldest_first' | 'largest_first'>('oldest_first');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    deletedCount?: number;
    remainingCount?: number;
  } | null>(null);

  const handleCleanup = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await apiClient.cleanupFiles({
        maxFileCount,
        strategy
      });

      setResult({
        success: true,
        message: `文件清理完成！删除了 ${response.deletedCount} 个文件，剩余 ${response.remainingCount} 个文件`,
        deletedCount: response.deletedCount,
        remainingCount: response.remainingCount
      });
    } catch (error) {
      console.error('文件清理失败:', error);
      setResult({
        success: false,
        message: '文件清理失败，请检查网络连接或服务器状态'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>文件清理测试</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* 最大文件数量 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              保留文件数量
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={maxFileCount}
              onChange={(e) => setMaxFileCount(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">设置要保留的文件数量</p>
          </div>

          {/* 清理策略 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              清理策略
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as 'oldest_first' | 'largest_first')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="oldest_first">最旧优先 - 删除最早的文件</option>
              <option value="largest_first">最大优先 - 删除最大的文件</option>
            </select>
          </div>

          {/* 结果显示 */}
          {result && (
            <div className={`p-3 rounded-md ${
              result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              <p className="text-sm font-medium">{result.message}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={handleCleanup}
              disabled={loading}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{loading ? '清理中...' : '开始清理'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
