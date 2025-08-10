import { useState } from 'react';
import { Wifi, WifiOff, Smartphone, Users, RefreshCw } from 'lucide-react';
import type { Device } from '../../shared/types';

interface ConnectionStatusProps {
  isConnected: boolean;
  deviceId: string;
  devices: Device[];
  onReconnect: () => void;
  onRefreshDevices: () => void;
}

export default function ConnectionStatus({
  isConnected,
  deviceId,
  devices,
  onReconnect,
  onRefreshDevices
}: ConnectionStatusProps) {
  const [showDevices, setShowDevices] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const connectedDevices = devices.filter(device => device.isConnected);
  const currentDevice = devices.find(device => device.deviceId === deviceId);

  const handleRefreshDevices = async () => {
    setIsRefreshing(true);
    await onRefreshDevices();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const formatLastSync = (lastSync: string) => {
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
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

        {/* 设备信息和操作 */}
        <div className="flex items-center space-x-4">
          {/* 在线设备数量 */}
          <div className="flex items-center space-x-2 text-gray-600">
            <Users className="w-4 h-4" />
            <span className="text-sm">
              {connectedDevices.length} 台设备在线
            </span>
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={handleRefreshDevices}
            disabled={isRefreshing}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
            title="刷新设备列表"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* 设备列表切换 */}
          <button
            onClick={() => setShowDevices(!showDevices)}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
          >
            <Smartphone className="w-4 h-4" />
            <span>设备</span>
          </button>
        </div>
      </div>

      {/* 当前设备信息 */}
      {currentDevice && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4" />
              <span>当前设备: {currentDevice.deviceName}</span>
            </div>
            <span>设备ID: {deviceId.slice(-8)}</span>
          </div>
        </div>
      )}

      {/* 设备列表 */}
      {showDevices && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">所有设备</h4>
          
          {devices.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <Smartphone className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">暂无设备信息</p>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.deviceId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    device.deviceId === deviceId
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      device.isConnected ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {device.deviceName}
                        </span>
                        {device.deviceId === deviceId && (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            当前
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {device.deviceId.slice(-12)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-xs font-medium ${
                      device.isConnected ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {device.isConnected ? '在线' : '离线'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatLastSync(device.lastSync)}
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