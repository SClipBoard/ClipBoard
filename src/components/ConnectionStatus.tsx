import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Smartphone, Users, RefreshCw } from 'lucide-react';
import { apiClient } from '../lib/api';
import { wsManager } from '../lib/websocket';
import type { ConnectionStats } from '../../shared/types';

interface ConnectionStatusProps {
  isConnected: boolean;
  deviceId: string;
  onReconnect: () => void;
}

export default function ConnectionStatus({
  isConnected,
  deviceId,
  onReconnect
}: ConnectionStatusProps) {
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({
    totalConnections: 0,
    activeConnections: 0,
    connectedDevices: []
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);

  // 加载连接统计（仅用于手动刷新）
  const loadConnectionStats = async () => {
    try {
      const stats = await apiClient.getConnectionStats();
      console.log('连接统计数据:', stats); // 调试信息
      setConnectionStats(stats);
    } catch (error) {
      console.error('获取连接统计失败:', error);
    }
  };

  // 监听WebSocket连接统计推送
  useEffect(() => {
    // 初始加载一次连接统计
    loadConnectionStats();

    // 设置WebSocket事件处理器
    wsManager.setHandlers({
      onConnectionStats: (stats: ConnectionStats) => {
        console.log('收到连接统计推送:', stats);
        setConnectionStats(stats);
      }
    });

    // 清理函数
    return () => {
      // 移除连接统计处理器（保留其他处理器）
      wsManager.setHandlers({
        onConnectionStats: undefined
      });
    };
  }, []);

  const handleRefreshStats = async () => {
    setIsRefreshing(true);
    await loadConnectionStats();
    setTimeout(() => setIsRefreshing(false), 1000);
  };



  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* 连接状态 */}
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 ${
            isConnected ? 'text-green-600' : 'text-red-600'
          }`}>
            {isConnected ? (
              <Wifi className="w-5 h-5" />
            ) : (
              <WifiOff className="w-5 h-5" />
            )}
            <span className="font-medium">
              {isConnected ? '已连接' : '未连接'}
            </span>
          </div>
          
          {!isConnected && (
            <button
              onClick={onReconnect}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              重新连接
            </button>
          )}
        </div>

        {/* 连接信息和操作 */}
        <div className="flex items-center space-x-4">
          {/* 在线连接数量 */}
          <div className="flex items-center space-x-2 text-gray-600">
            <Users className="w-4 h-4" />
            <span className="text-sm">
              {connectionStats.activeConnections} 个活跃连接
            </span>
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={handleRefreshStats}
            disabled={isRefreshing}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
            title="刷新连接统计"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* 当前设备信息 */}
          <button
            onClick={() => setShowDeviceList(!showDeviceList)}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
            title="点击查看所有连接的设备"
          >
            <Smartphone className="w-4 h-4" />
            <span>当前设备: {deviceId.slice(-8)}</span>
          </button>
        </div>
      </div>

      {/* 连接设备列表 */}
      {showDeviceList && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-2">连接的设备</h4>
          {connectionStats.connectedDevices.length === 0 ? (
            <div className="text-center py-2 text-gray-500">
              <p className="text-sm">暂无连接的设备</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connectionStats.connectedDevices.map((device, index) => (
                <div
                  key={device.connectionId}
                  className={`flex items-center justify-between p-2 rounded-md border ${
                    device.deviceId === deviceId
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium text-gray-900">
                      设备 {index + 1}
                    </span>
                    {device.deviceId === deviceId && (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 font-mono">
                      {device.deviceId.slice(-12)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}