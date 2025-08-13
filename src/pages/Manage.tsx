import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Square, Trash2, Download, Upload, FileText, Image, Filter, Search, RefreshCw, AlertCircle, Check } from 'lucide-react';
import ClipboardItem from '../components/ClipboardItem';
import { apiClient } from '../lib/api';
import type { ClipboardItem as ClipboardItemType, PaginationParams } from '../../shared/types';

export default function Manage() {
  const [items, setItems] = useState<ClipboardItemType[]>([]);

  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'text' | 'image'>('all');

  const [showFilters, setShowFilters] = useState(false);
  
  // 操作状态
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [operationResult, setOperationResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const itemsPerPage = 50;

  // 加载剪切板内容
  const loadItems = useCallback(async (
    page: number = 1,
    append: boolean = false,
    customSearch?: string
  ) => {
    try {
      const params: PaginationParams & {
        type?: 'text' | 'image';
        search?: string;
      } = {
        page,
        limit: itemsPerPage
      };

      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      // 使用传入的搜索参数或当前状态的搜索查询
      const currentSearch = customSearch !== undefined ? customSearch : searchQuery;
      if (currentSearch) {
        params.search = currentSearch;
      }
      
      const response = await apiClient.getClipboardItems(params);
      
      if (append) {
        setItems(prev => [...prev, ...response.data]);
      } else {
        setItems(response.data);
        setSelectedItems(new Set()); // 清空选择
      }
      
      setTotalItems(response.total);
      setHasMore(response.data.length === itemsPerPage);
    } catch (error) {
      console.error('加载剪切板内容失败:', error);
    }
  }, [typeFilter, searchQuery]);

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadItems(1);
      setLoading(false);
    };

    init();
  }, [loadItems]);

  // 筛选条件变化时重新加载（移除searchQuery的自动触发）
  useEffect(() => {
    setCurrentPage(1);
    loadItems(1);
  }, [typeFilter, loadItems]);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  }, [selectedItems.size, items]);

  // 选择/取消选择单个项目
  const handleSelectItem = useCallback((itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  }, [selectedItems]);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedItems.size === 0) return;
    
    setDeleting(true);
    setOperationResult(null);
    
    try {
      const deletePromises = Array.from(selectedItems).map(id => 
        apiClient.deleteClipboardItem(id)
      );
      
      await Promise.all(deletePromises);
      
      setItems(prev => prev.filter(item => !selectedItems.has(item.id)));
      setTotalItems(prev => prev - selectedItems.size);
      setSelectedItems(new Set());
      
      setOperationResult({
        success: true,
        message: `成功删除 ${selectedItems.size} 项内容`
      });
    } catch (error) {
      console.error('批量删除失败:', error);
      setOperationResult({
        success: false,
        message: '批量删除失败，请重试'
      });
    } finally {
      setDeleting(false);
      setTimeout(() => setOperationResult(null), 3000);
    }
  }, [selectedItems]);

  // 导出数据
  const handleExport = useCallback(async () => {
    setExporting(true);
    setOperationResult(null);
    
    try {
      // 获取所有数据
      const allItems = await apiClient.getClipboardItems({ page: 1, limit: 10000 });
      
      const exportData = {
        exportTime: new Date().toISOString(),
        totalItems: allItems.total,
        items: allItems.data.map(item => ({
          id: item.id,
          type: item.type,
          content: item.content,
          deviceId: item.deviceId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }))
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clipboard-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setOperationResult({
        success: true,
        message: `成功导出 ${allItems.total} 项内容`
      });
    } catch (error) {
      console.error('导出失败:', error);
      setOperationResult({
        success: false,
        message: '导出失败，请重试'
      });
    } finally {
      setExporting(false);
      setTimeout(() => setOperationResult(null), 3000);
    }
  }, []);

  // 导入数据
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setOperationResult(null);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);
        
        if (!importData.items || !Array.isArray(importData.items)) {
          throw new Error('无效的导入文件格式');
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const item of importData.items) {
          try {
            await apiClient.createClipboardItem({
              type: item.type,
              content: item.content,
              deviceId: item.deviceId
            });
            successCount++;
          } catch (error) {
            errorCount++;
            console.error('导入项目失败:', error);
          }
        }
        
        setOperationResult({
          success: true,
          message: `导入完成：成功 ${successCount} 项，失败 ${errorCount} 项`
        });
        
        // 重新加载数据
        await loadItems(1);
      } catch (error) {
        console.error('导入失败:', error);
        setOperationResult({
          success: false,
          message: '导入失败，请检查文件格式'
        });
      } finally {
        setImporting(false);
        setTimeout(() => setOperationResult(null), 5000);
      }
    };
    
    reader.readAsText(file);
    
    // 清空文件输入
    event.target.value = '';
  }, [loadItems]);

  // 处理复制
  const handleCopy = useCallback((content: string) => {
    console.log('已复制到剪切板:', content.substring(0, 50) + '...');
  }, []);

  // 处理删除单个项目
  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiClient.deleteClipboardItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      setTotalItems(prev => prev - 1);
      setSelectedItems(prev => {
        const newSelected = new Set(prev);
        newSelected.delete(id);
        return newSelected;
      });
    } catch (error) {
      console.error('删除失败:', error);
    }
  }, []);

  // 加载更多
  const handleLoadMore = useCallback(async () => {
    if (hasMore && !loading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      await loadItems(nextPage, true);
    }
  }, [currentPage, hasMore, loading, loadItems]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-8">
        {/* 页面标题 - 仅PC端显示 */}
        <div className="hidden md:block mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            内容管理
          </h1>
          <p className="text-gray-600">
            批量管理剪切板内容，支持导入导出和批量操作
          </p>
        </div>

        {/* 搜索和筛选 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          {/* 搜索框 */}
          <div className="relative mb-4">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  // 立即触发搜索
                  setCurrentPage(1);
                  loadItems(1, false, searchQuery);
                }
              }}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="搜索剪切板内容（按回车搜索）..."
            />
          </div>

          {/* 筛选器 */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
            >
              <Filter className="h-4 w-4" />
              <span>筛选器</span>
            </button>

            <div className="text-sm text-gray-500">
              共 {totalItems} 项内容
              {selectedItems.size > 0 && (
                <span className="ml-2 text-blue-600">
                  已选择 {selectedItems.size} 项
                </span>
              )}
            </div>
          </div>

          {/* 筛选器面板 */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 内容类型筛选 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    内容类型
                  </label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setTypeFilter('all')}
                      className={`px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                        typeFilter === 'all'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      全部
                    </button>
                    <button
                      onClick={() => setTypeFilter('text')}
                      className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                        typeFilter === 'text'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FileText className="h-4 w-4" />
                      <span>文字</span>
                    </button>
                    <button
                      onClick={() => setTypeFilter('image')}
                      className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                        typeFilter === 'image'
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <Image className="h-4 w-4" />
                      <span>图片</span>
                    </button>
                  </div>
                </div>


              </div>
            </div>
          )}
        </div>

        {/* 批量操作工具栏 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* 全选 */}
              <button
                onClick={handleSelectAll}
                className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900"
              >
                {selectedItems.size === items.length && items.length > 0 ? (
                  <CheckSquare className="w-5 h-5 text-blue-600" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
                <span>全选</span>
              </button>

              {/* 批量删除 */}
              {selectedItems.size > 0 && (
                <button
                  onClick={handleBatchDelete}
                  disabled={deleting}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                    deleting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{deleting ? '删除中...' : `删除 ${selectedItems.size} 项`}</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* 导入 */}
              <label className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors duration-200 ${
                importing
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}>
                <Upload className="w-4 h-4" />
                <span>{importing ? '导入中...' : '导入'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  disabled={importing}
                  className="hidden"
                />
              </label>

              {/* 导出 */}
              <button
                onClick={handleExport}
                disabled={exporting}
                className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                  exporting
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{exporting ? '导出中...' : '导出'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 操作结果提示 */}
        {operationResult && (
          <div className={`rounded-lg p-4 mb-6 ${
            operationResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              {operationResult.success ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${
                operationResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {operationResult.message}
              </span>
            </div>
          </div>
        )}

        {/* 内容列表 */}
        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                暂无内容
              </h3>
              <p className="text-gray-500">
                {searchQuery || typeFilter !== 'all'
                  ? '没有找到符合条件的内容'
                  : '还没有剪切板内容'
                }
              </p>
            </div>
          ) : (
            <>
              {items.map((item) => (
                <div key={item.id} className="flex items-start space-x-4">
                  {/* 选择框 */}
                  <button
                    onClick={() => handleSelectItem(item.id)}
                    className="mt-4 flex-shrink-0"
                  >
                    {selectedItems.has(item.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                  
                  {/* 内容项 */}
                  <div className="flex-1">
                    <ClipboardItem
                      item={item}
                      onCopy={handleCopy}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              ))}
              
              {/* 加载更多按钮 */}
              {hasMore && (
                <div className="text-center py-6">
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-3 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  >
                    加载更多
                  </button>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  );
}