import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [totalItems, setTotalItems] = useState(0); // 筛选后的结果数
  const [allTotalItems, setAllTotalItems] = useState(0); // 全部内容总数
  const [hasMore, setHasMore] = useState(true);
  const [deletingItems, setDeletingItems] = useState<Set<string>>(new Set()); // 跟踪正在删除的项目
  const deletingItemsRef = useRef<Set<string>>(new Set()); // 使用ref确保WebSocket事件能获取到最新状态

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
        // 更新全部内容总数，如果API返回了allTotal字段
        if (response.allTotal !== undefined) {
          setAllTotalItems(response.allTotal);
          console.log('初始化：设置统计数据 - totalItems:', response.total, 'allTotalItems:', response.allTotal);
        } else {
          // 如果API没有返回allTotal，使用total作为fallback
          setAllTotalItems(response.total || 0);
          console.log('初始化：API未返回allTotal，使用total作为fallback:', response.total);
        }
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
        // 总是更新全部内容总数
        setAllTotalItems(prev => prev + 1);

        // 检查新项目是否符合当前筛选条件
        const matchesFilter = () => {
          // 检查类型筛选
          if (typeFilter !== 'all' && newItem.type !== typeFilter) {
            return false;
          }

          // 检查搜索条件
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const contentMatch = newItem.type === 'text' && newItem.content.toLowerCase().includes(query);
            const fileNameMatch = newItem.fileName && newItem.fileName.toLowerCase().includes(query);
            if (!contentMatch && !fileNameMatch) {
              return false;
            }
          }

          return true;
        };

        // 如果没有筛选条件或新项目符合筛选条件，则添加到列表
        if (!searchQuery && typeFilter === 'all') {
          // 无筛选条件，直接添加
          setItems(prev => {
            const existingIndex = prev.findIndex(item => item.id === newItem.id);
            if (existingIndex !== -1) {
              console.log('更新现有项目:', newItem.id);
              const updatedItems = [...prev];
              updatedItems[existingIndex] = newItem;
              return updatedItems;
            } else {
              console.log('添加新项目到列表:', newItem.id);
              setTotalItems(prev => prev + 1);
              return [newItem, ...prev];
            }
          });
        } else if (matchesFilter()) {
          // 有筛选条件但新项目符合条件，添加到列表
          setItems(prev => {
            const existingIndex = prev.findIndex(item => item.id === newItem.id);
            if (existingIndex !== -1) {
              console.log('更新现有项目:', newItem.id);
              const updatedItems = [...prev];
              updatedItems[existingIndex] = newItem;
              return updatedItems;
            } else {
              console.log('添加符合筛选条件的新项目:', newItem.id);
              setTotalItems(prev => prev + 1);
              return [newItem, ...prev];
            }
          });
        } else {
          // 新项目不符合当前筛选条件，不添加到列表但提示用户
          console.log('新项目不符合当前筛选条件，已添加到总库但不显示在当前列表中');
        }
      },
      onDeleteItem: (itemId) => {
        // 使用ref检查，确保能获取到最新的删除状态
        const isLocallyDeleting = deletingItemsRef.current.has(itemId);
        if (isLocallyDeleting) {
          // 本标签页刚执行过乐观删除，跳过WS重复处理
          return;
        }

        // 来自其他标签页/设备的删除，基于最新列表做幂等处理
        setItems(prev => {
          const next = prev.filter(item => item.id !== itemId);
          const removedCount = prev.length - next.length;
          if (removedCount > 0) {
            // 只有当当前列表确实移除了项目时，才更新筛选后的计数
            setTotalItems(p => Math.max(0, p - removedCount));
          }
          return next;
        });

        // 无论当前筛选列表是否包含该项目，全部总数都要递减一次
        setAllTotalItems(prev => Math.max(0, prev - 1));
      },
      onSync: (syncItems) => {
        // 只有在没有搜索查询和类型筛选时才同步数据，避免覆盖搜索结果
        if (!searchQuery && typeFilter === 'all') {
          setItems(syncItems);
          setTotalItems(syncItems.length);
          setAllTotalItems(syncItems.length); // 在全量同步时，两个总数应该相等
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

  // 处理更新
  const handleUpdate = useCallback(async (id: string, updates: { content?: string; fileName?: string }) => {
    try {
      const updatedItem = await apiClient.updateClipboardItem(id, updates);
      setItems(prev => prev.map(item =>
        item.id === id ? updatedItem : item
      ));
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败，请重试');
    }
  }, []);

  // 处理删除
  const handleDelete = useCallback(async (id: string) => {
    // 防止重复删除
    if (deletingItems.has(id)) {
      console.log('项目正在删除中，跳过重复操作:', id);
      return;
    }

    // 先找到要删除的项目（在try块外定义，以便在catch块中使用）
    const itemToDelete = items.find(item => item.id === id);

    try {
      // 立即标记为正在删除，防止重复调用
      const newDeletingItems = new Set([...deletingItems, id]);
      setDeletingItems(newDeletingItems);
      deletingItemsRef.current = newDeletingItems;
      console.log('标记项目为正在删除:', id, '当前deletingItems:', Array.from(newDeletingItems));

      // 先乐观更新UI，立即从列表中移除项目
      if (itemToDelete) {
        setItems(prev => prev.filter(item => item.id !== id));
        setTotalItems(prev => Math.max(0, prev - 1));
        setAllTotalItems(prev => Math.max(0, prev - 1));
        console.log('乐观更新：从列表中移除项目', id);
      }

      // 然后发送删除请求
      await apiClient.deleteClipboardItem(id);
      console.log('删除请求成功:', id);

    } catch (error) {
      console.error('删除失败:', error);

      // 如果删除失败，恢复项目到列表中
      if (itemToDelete) {
        setItems(prev => {
          // 检查项目是否已经在列表中（避免重复添加）
          const exists = prev.some(item => item.id === id);
          if (!exists) {
            // 将项目重新插入到原来的位置（这里简单地插入到开头）
            setTotalItems(prevTotal => prevTotal + 1);
            setAllTotalItems(prevTotal => prevTotal + 1);
            return [itemToDelete, ...prev];
          }
          return prev;
        });
        console.log('删除失败，已恢复项目到列表');
      }

      alert('删除失败，请重试');
    } finally {
      // 延迟清理删除标记，给WebSocket事件足够时间来检查状态
      setTimeout(() => {
        setDeletingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(id);
          deletingItemsRef.current = newSet;
          console.log('清理删除标记:', id, '剩余deletingItems:', Array.from(newSet));
          return newSet;
        });
      }, 1000); // 延迟1秒清理
    }
  }, [items, deletingItems]);



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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 md:py-8">
        {/* 移动端搜索框 - 放在最上面 */}
        <div className="md:hidden mb-4">
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
        </div>

        {/* 页面标题 - 仅PC端显示 */}
        <div className="hidden md:block mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            剪切板同步
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

        {/* PC端搜索和筛选 */}
        <div className="hidden md:block">
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
        </div>

        {/* 操作按钮 - PC端显示 */}
        <div className="hidden md:flex items-center justify-between mb-6">
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
            {searchQuery || typeFilter !== 'all' ? (
              <span>
                找到 {totalItems} 项内容 / 共 {allTotalItems} 项
              </span>
            ) : (
              <span>共 {allTotalItems} 项内容</span>
            )}
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
                  onUpdate={handleUpdate}
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