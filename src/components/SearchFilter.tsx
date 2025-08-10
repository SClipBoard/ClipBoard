import { useState, useEffect } from 'react';
import { Search, Filter, FileText, Image, File, X } from 'lucide-react';
import type { Device } from '../../shared/types';

interface SearchFilterProps {
  onSearch: (query: string) => void;
  onTypeFilter: (type: 'all' | 'text' | 'image' | 'file') => void;
  onDeviceFilter: (deviceId: string | null) => void;
  devices: Device[];
  currentType: 'all' | 'text' | 'image' | 'file';
  currentDevice: string | null;
}

export default function SearchFilter({
  onSearch,
  onTypeFilter,
  onDeviceFilter,
  devices,
  currentType,
  currentDevice
}: SearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // 移除自动搜索，只保留手动搜索

  // 处理回车键搜索
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 执行搜索
  const handleSearch = () => {
    setIsSearching(true);
    onSearch(searchQuery);
    setTimeout(() => setIsSearching(false), 500);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(true);
    onSearch('');
    setTimeout(() => setIsSearching(false), 500);
  };

  const handleClearFilters = () => {
    onTypeFilter('all');
    onDeviceFilter(null);
    setSearchQuery('');
    setIsSearching(true);
    onSearch('');
    setTimeout(() => setIsSearching(false), 500);
  };

  const hasActiveFilters = currentType !== 'all' || currentDevice !== null || searchQuery.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      {/* 搜索框 */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className={`h-5 w-5 ${isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder="搜索剪切板内容（按回车搜索）..."
        />
        <div className="absolute inset-y-0 right-0 flex items-center">
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="pr-2 flex items-center"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
          <button
            onClick={handleSearch}
            className="pr-3 flex items-center text-blue-600 hover:text-blue-800"
            title="搜索"
          >
            <Search className={`h-5 w-5 ${isSearching ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </div>

      {/* 筛选器切换按钮 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors duration-200"
        >
          <Filter className="h-4 w-4" />
          <span>筛选器</span>
          {hasActiveFilters && (
            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
              !
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            清除所有筛选
          </button>
        )}
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
                  onClick={() => onTypeFilter('all')}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                    currentType === 'all'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>全部</span>
                </button>
                <button
                  onClick={() => onTypeFilter('text')}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                    currentType === 'text'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>文字</span>
                </button>
                <button
                  onClick={() => onTypeFilter('image')}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                    currentType === 'image'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Image className="h-4 w-4" />
                  <span>图片</span>
                </button>
                <button
                  onClick={() => onTypeFilter('file')}
                  className={`flex items-center space-x-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                    currentType === 'file'
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <File className="h-4 w-4" />
                  <span>文件</span>
                </button>
              </div>
            </div>

            {/* 设备筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                来源设备
              </label>
              <select
                value={currentDevice || ''}
                onChange={(e) => onDeviceFilter(e.target.value || null)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">所有设备</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.deviceName} ({device.deviceId.slice(-8)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 活动筛选器显示 */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {currentType !== 'all' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    类型: {currentType === 'text' ? '文字' : currentType === 'image' ? '图片' : '文件'}
                    <button
                      onClick={() => onTypeFilter('all')}
                      className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {currentDevice && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    设备: {devices.find(d => d.deviceId === currentDevice)?.deviceName || currentDevice.slice(-8)}
                    <button
                      onClick={() => onDeviceFilter(null)}
                      className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-green-400 hover:bg-green-200 hover:text-green-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    搜索: "{searchQuery}"
                    <button
                      onClick={handleClearSearch}
                      className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-purple-400 hover:bg-purple-200 hover:text-purple-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}