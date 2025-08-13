import { useState, useEffect } from 'react';
import { Search, Filter, FileText, Image, File, X } from 'lucide-react';

interface SearchFilterProps {
  onSearch: (query: string) => void;
  onTypeFilter: (type: 'all' | 'text' | 'image' | 'file') => void;
  currentType: 'all' | 'text' | 'image' | 'file';
  currentSearch?: string; // 当前搜索查询，用于同步显示
}

export default function SearchFilter({
  onSearch,
  onTypeFilter,
  currentType,
  currentSearch = ''
}: SearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState(currentSearch);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // 同步外部搜索状态到内部状态
  useEffect(() => {
    setSearchQuery(currentSearch);
  }, [currentSearch]);

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
    setSearchQuery('');
    setIsSearching(true);
    onSearch('');
    setTimeout(() => setIsSearching(false), 500);
  };

  // 添加点击外部区域隐藏筛选器的逻辑
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const searchContainer = target.closest('.search-filter-container');
      if (!searchContainer && showMobileFilters && !isSearchFocused) {
        setShowMobileFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMobileFilters, isSearchFocused]);

  const hasActiveFilters = currentType !== 'all' || searchQuery.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 search-filter-container">
      {/* 移动端布局 */}
      <div className="md:hidden">
        {/* 搜索框 */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className={`h-4 w-4 ${isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            onFocus={() => {
              setIsSearchFocused(true);
              setShowMobileFilters(true);
            }}
            onBlur={(e) => {
              setIsSearchFocused(false);
              // 延迟隐藏筛选器，给用户时间点击筛选按钮
              setTimeout(() => {
                // 检查焦点是否在筛选器区域内
                if (!e.currentTarget.parentElement?.parentElement?.contains(document.activeElement)) {
                  setShowMobileFilters(false);
                }
              }, 150);
            }}
            className="block w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="搜索剪切板内容"
          />
          <div className="absolute inset-y-0 right-0 flex items-center">
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="pr-2 flex items-center"
              >
                <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
            <button
              onClick={handleSearch}
              className="pr-3 flex items-center text-blue-600 hover:text-blue-800"
              title="搜索"
            >
              <Search className={`h-4 w-4 ${isSearching ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>

        {/* 移动端筛选器 - 在搜索框聚焦或有筛选条件时显示 */}
        {(showMobileFilters || hasActiveFilters) && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  onTypeFilter('all');
                  setShowMobileFilters(true); // 保持筛选器显示
                }}
                onMouseDown={(e) => e.preventDefault()} // 防止搜索框失去焦点
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 ${
                  currentType === 'all'
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="全部"
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  onTypeFilter('text');
                  setShowMobileFilters(true); // 保持筛选器显示
                }}
                onMouseDown={(e) => e.preventDefault()} // 防止搜索框失去焦点
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 ${
                  currentType === 'text'
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="文字"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  onTypeFilter('image');
                  setShowMobileFilters(true); // 保持筛选器显示
                }}
                onMouseDown={(e) => e.preventDefault()} // 防止搜索框失去焦点
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 ${
                  currentType === 'image'
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="图片"
              >
                <Image className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  onTypeFilter('file');
                  setShowMobileFilters(true); // 保持筛选器显示
                }}
                onMouseDown={(e) => e.preventDefault()} // 防止搜索框失去焦点
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 ${
                  currentType === 'file'
                    ? 'bg-blue-100 text-blue-600 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="文件"
              >
                <File className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    handleClearFilters();
                    setShowMobileFilters(false); // 清除后隐藏筛选器
                  }}
                  onMouseDown={(e) => e.preventDefault()} // 防止搜索框失去焦点
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded-md"
                >
                  清除
                </button>
              )}
              {/* 添加关闭按钮 */}
              <button
                onClick={() => setShowMobileFilters(false)}
                onMouseDown={(e) => e.preventDefault()} // 防止搜索框失去焦点
                className="text-gray-400 hover:text-gray-600 p-1"
                title="隐藏筛选器"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PC端布局 */}
      <div className="hidden md:block">
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
            placeholder="搜索剪切板内容（按回车键）"
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

        {/* PC端筛选器面板 */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            {/* 内容类型筛选 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                内容类型
              </label>
              <div className="flex flex-wrap gap-2">
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
    </div>
  );
}