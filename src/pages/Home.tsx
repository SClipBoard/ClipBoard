import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import ClipboardItem from '../components/ClipboardItem';
import SearchFilter from '../components/SearchFilter';
import ConnectionStatus from '../components/ConnectionStatus';
import { apiClient } from '../lib/api';
import { wsManager, deviceId } from '../lib/websocket';
import type { ClipboardItem as ClipboardItemType, Device, PaginationParams } from '../../shared/types';

export default function Home() {
  const [items, setItems] = useState<ClipboardItemType[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  // 筛选状态
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'text' | 'image' | 'file'>('all');
  const [deviceFilter, setDeviceFilter] = useState<string | null>(null);
  

  
  const itemsPerPage = 20;

  // 加载剪切板内容
  const loadItems = useCallback(async (page: number = 1, append: boolean = false) => {
    try {
      const params: PaginationParams & {
        type?: 'text' | 'image' | 'file';
        search?: string;
        deviceId?: string;
      } = {
        page,
        limit: itemsPerPage
      };
      
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      if (deviceFilter) {
        params.deviceId = deviceFilter;
      }
      
      const response = await apiClient.getClipboardItems(params);
      
      if (response && response.data) {
        if (append) {
          setItems(prev => [...prev, ...response.data]);
        } else {
          setItems(response.data);
        }
        
        setTotalItems(response.total || 0);
        setHasMore(response.data.length === itemsPerPage);
      } else if (response && response.data === null) {
        // 只有在明确返回空数据时才清空
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
  }, [searchQuery, typeFilter, deviceFilter]);

  // 加载设备列表
  const loadDevices = useCallback(async () => {
    try {
      const deviceList = await apiClient.getDevices();
      setDevices(deviceList);
    } catch (error) {
      console.error('加载设备列表失败:', error);
    }
  }, []);

  // 初始化
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([
        loadItems(1),
        loadDevices()
      ]);
      setLoading(false);
    };
    
    init();
  }, [loadItems, loadDevices]);

  // 筛选条件变化时重新加载
  useEffect(() => {
    setCurrentPage(1);
    loadItems(1);
  }, [searchQuery, typeFilter, deviceFilter, loadItems]);

  // WebSocket连接管理
  useEffect(() => {
    // 设置WebSocket事件处理器
    wsManager.setHandlers({
      onConnect: () => {
        setIsConnected(true);
        console.log('WebSocket已连接');
        // 连接建立后自动请求同步所有内容
        wsManager.requestSync();
      },
      onDisconnect: () => {
        setIsConnected(false);
        console.log('WebSocket已断开');
      },
      onNewItem: (newItem) => {
        setItems(prev => [newItem, ...prev]);
        setTotalItems(prev => prev + 1);
      },
      onDeleteItem: (itemId) => {
        setItems(prev => prev.filter(item => item.id !== itemId));
        setTotalItems(prev => prev - 1);
      },
      onSync: (syncItems) => {
        setItems(syncItems);
        setTotalItems(syncItems.length);
      },
      onError: (error) => {
        console.error('WebSocket错误:', error);
      }
    });

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
  }, []);

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

  // 处理刷新
  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      setCurrentPage(1);
      await Promise.all([
        loadItems(1),
        loadDevices()
      ]);
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      setLoading(false);
    }
  }, [loadItems, loadDevices]);

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
          <p className="text-gray-600">
            跨设备同步您的剪切板内容，支持文字、图片和文件
          </p>
        </div>

        {/* 连接状态 */}
        <ConnectionStatus
          isConnected={isConnected}
          deviceId={deviceId}
          devices={devices}
          onReconnect={handleReconnect}
          onRefreshDevices={loadDevices}
        />

        {/* 搜索和筛选 */}
        <SearchFilter
          onSearch={setSearchQuery}
          onTypeFilter={setTypeFilter}
          onDeviceFilter={setDeviceFilter}
          devices={devices}
          currentType={typeFilter}
          currentDevice={deviceFilter}
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
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              <RefreshCw className="w-4 h-4" />
              <span>刷新</span>
            </button>
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
                {searchQuery || typeFilter !== 'all' || deviceFilter
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
    </div>
  );
}