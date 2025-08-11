import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Settings, Keyboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import ClipboardItem from '../components/ClipboardItem';
import SearchFilter from '../components/SearchFilter';
import ConnectionStatus from '../components/ConnectionStatus';
import GlobalPasteIndicator from '../components/GlobalPasteIndicator';
import GlobalDropIndicator from '../components/GlobalDropIndicator';
import { apiClient } from '../lib/api';
import { wsManager, deviceId } from '../lib/websocket';
import { useGlobalPaste } from '../hooks/useGlobalPaste';
import { useGlobalDrop } from '../hooks/useGlobalDrop';
import type { ClipboardItem as ClipboardItemType, PaginationParams } from '../../shared/types';

export default function Home() {
  const [items, setItems] = useState<ClipboardItemType[]>([]);

  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'text' | 'image' | 'file'>('all');

  // 全局粘贴功能
  const { isPasting, lastPasteResult, clearLastResult } = useGlobalPaste({
    enabled: true,
    onPasteComplete: (result) => {
      if (result.success && result.item) {
        // 不在这里直接添加到列表，完全依赖 WebSocket 的 onNewItem 事件来处理
        // 这样可以确保数据的一致性，避免重复添加
        console.log('全局粘贴成功，等待 WebSocket 同步更新列表');
      }
    }
  });

  // 全局拖拽功能
  const { isDragging, isUploading, lastDropResult, clearLastResult: clearDropResult } = useGlobalDrop({
    enabled: true,
    onDropComplete: (result) => {
      if (result.success && result.item) {
        // 不在这里直接添加到列表，完全依赖 WebSocket 的 onNewItem 事件来处理
        // 这样可以确保数据的一致性，避免重复添加
        console.log('全局拖拽上传成功，等待 WebSocket 同步更新列表');
      }
    }
  });
  

  
  const itemsPerPage = 20;

  // 加载剪切板内容
  const loadItems = useCallback(async (
    page: number = 1,
    append: boolean = false,
    customSearch?: string
  ) => {
    try {
      const params: PaginationParams & {
        type?: 'text' | 'image' | 'file';
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

      if (response && Array.isArray(response.data)) {
        if (append) {
          setItems(prev => [...prev, ...response.data]);
        } else {
          setItems(response.data);
        }

        setTotalItems(response.total || 0);
        setHasMore(response.data.length === itemsPerPage);
      } else {
        // 处理无效响应或错误情况
        console.warn('API响应格式异常:', response);
        if (!append) {
          setItems([]);
          setTotalItems(0);
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('加载剪切板内容失败:', error);
      // 出错时不清空现有数据，保持用户体验
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
    console.log('类型筛选变化，重新加载数据，typeFilter:', typeFilter);
    setCurrentPage(1);
    loadItems(1);
  }, [typeFilter]); // 移除loadItems依赖，避免循环依赖



  // WebSocket连接管理 - 只在组件挂载时建立连接
  useEffect(() => {
    // 立即检查连接状态，如果未连接则尝试连接
    if (!wsManager.isConnected()) {
      // 立即尝试连接，不等待
      setTimeout(() => {
        if (!wsManager.isConnected()) {
          wsManager.connect();
        }
      }, 200); // 只等待200ms确保WebSocket管理器初始化完成
    }

    // 清理函数
    return () => {
      wsManager.disconnect();
    };
  }, []); // 空依赖数组，只在组件挂载时执行

  // WebSocket事件处理器 - 根据搜索状态动态更新
  useEffect(() => {
    // 设置WebSocket事件处理器
    wsManager.setHandlers({
      onConnect: () => {
        setIsConnected(true);
        console.log('WebSocket已连接');
        // 只有在没有搜索查询和类型筛选时才自动同步
        if (!searchQuery && typeFilter === 'all') {
          wsManager.requestSync();
        }
      },
      onDisconnect: () => {
        setIsConnected(false);
        console.log('WebSocket已断开');
      },
      onNewItem: (newItem) => {
        // 只有在没有搜索查询和类型筛选时才添加新项目
        if (!searchQuery && typeFilter === 'all') {
          setItems(prev => {
            // 检查是否已存在，避免重复添加
            if (prev.some(item => item.id === newItem.id)) {
              console.log('项目已存在，跳过添加:', newItem.id);
              return prev;
            }
            console.log('添加新项目到列表:', newItem.id);
            return [newItem, ...prev];
          });
          setTotalItems(prev => prev + 1);
        }
      },
      onDeleteItem: (itemId) => {
        // 删除操作总是执行，因为用户可能在搜索结果中删除项目
        setItems(prev => prev.filter(item => item.id !== itemId));
        setTotalItems(prev => prev - 1);
      },
      onSync: (syncItems) => {
        // 只有在没有搜索查询和类型筛选时才同步数据，避免覆盖搜索结果
        if (!searchQuery && typeFilter === 'all') {
          setItems(syncItems);
          setTotalItems(syncItems.length);
        }
      },
      onError: (error) => {
        console.error('WebSocket错误:', error);
      }
    });
  }, [searchQuery, typeFilter]);

  // 处理复制
  const handleCopy = useCallback((content: string) => {
    console.log('已复制到剪切板:', content.substring(0, 50) + '...');
  }, []);

  // 处理删除
  const handleDelete = useCallback(async (id: string) => {
    try {
      await apiClient.deleteClipboardItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
      setTotalItems(prev => prev - 1);
    } catch (error) {
      console.error('删除失败:', error);
    }
  }, []);



  // 处理加载更多
  const handleLoadMore = useCallback(async () => {
    if (hasMore && !loading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      await loadItems(nextPage, true);
    }
  }, [currentPage, hasMore, loading, loadItems]);

  // 处理重连
  const handleReconnect = useCallback(() => {
    wsManager.reconnect();
  }, []);



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            共享剪切板
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-gray-600">
              跨设备同步您的剪切板内容，支持文字、图片和文件
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
                <Keyboard className="w-4 h-4" />
                <span>按 <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">Ctrl+V</kbd> 快速粘贴</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-500 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
                <Plus className="w-4 h-4 text-blue-600" />
                <span className="text-blue-700">拖拽文件到页面任意位置上传</span>
              </div>
            </div>
          </div>
        </div>

        {/* 连接状态 */}
        <ConnectionStatus
          isConnected={isConnected}
          deviceId={deviceId}
          onReconnect={handleReconnect}
        />

        {/* 搜索和筛选 */}
        <SearchFilter
          onSearch={(query) => {
            setSearchQuery(query);
            setCurrentPage(1);
            // 使用新的搜索参数立即加载数据
            loadItems(1, false, query);
          }}
          onTypeFilter={setTypeFilter}
          currentType={typeFilter}
          currentSearch={searchQuery}
        />

        {/* 操作按钮 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link
              to="/upload"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>上传内容</span>
            </Link>

            <Link
              to="/settings"
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              <Settings className="w-4 h-4" />
              <span>设置</span>
            </Link>
          </div>

          <div className="text-sm text-gray-500">
            共 {totalItems} 项内容
          </div>
        </div>

        {/* 内容列表 */}
        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                暂无剪切板内容
              </h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || typeFilter !== 'all'
                  ? '没有找到符合条件的内容'
                  : '开始使用剪切板同步功能吧'
                }
              </p>
            </div>
          ) : (
            <>
              {items.map((item) => (
                <ClipboardItem
                  key={item.id}
                  item={item}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                />
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

      {/* 全局粘贴指示器 */}
      <GlobalPasteIndicator
        isPasting={isPasting}
        lastPasteResult={lastPasteResult}
        onClearResult={clearLastResult}
      />

      {/* 全局拖拽指示器 */}
      <GlobalDropIndicator
        isDragging={isDragging}
        isUploading={isUploading}
        lastDropResult={lastDropResult}
        onClearResult={clearDropResult}
      />
    </div>
  );
}