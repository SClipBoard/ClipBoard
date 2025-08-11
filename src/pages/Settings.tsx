import { useState, useEffect, useCallback } from 'react';
import { Settings as SettingsIcon, Save, RefreshCw, AlertCircle, Check, Database, Clock, HardDrive, Trash2, ArrowLeft, Shield, Key } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { useSecurityStore } from '../lib/security-store';


interface AppConfig {
  maxItems: number;
  autoCleanupDays: number;
}

interface StorageStats {
  totalItems: number;
  textItems: number;
  imageItems: number;
  totalSize: string;
}

export default function Settings() {
  // 安全配置状态管理
  const { config: securityConfig, setConfig: setSecurityConfig } = useSecurityStore();

  const [config, setConfig] = useState<AppConfig>({
    maxItems: 1000,
    autoCleanupDays: 30
  });
  const [storageStats, setStorageStats] = useState<StorageStats>({
    totalItems: 0,
    textItems: 0,
    imageItems: 0,
    totalSize: '0 MB'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSecurityConfig, setSavingSecurityConfig] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [securitySaveResult, setSecuritySaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{ success: boolean; message: string; deletedCount?: number } | null>(null);
  const [clearResult, setClearResult] = useState<{ success: boolean; message: string; deletedCount?: number } | null>(null);


  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [configData, statsData] = await Promise.all([
        apiClient.getConfig().catch(() => ({
          maxItems: 1000,
          autoCleanupDays: 30
        })), // 如果获取配置失败，使用默认配置
        apiClient.getStorageStats().catch(() => ({
          totalItems: 0,
          textItems: 0,
          imageItems: 0,
          totalSize: '0 MB'
        })) // 如果获取统计失败，使用默认值
      ]);

      // 类型转换：将API返回的配置转换为AppConfig类型
      if (configData && typeof configData === 'object') {
        setConfig(configData as AppConfig);
      }
      setStorageStats(statsData);
    } catch (error) {
      console.error('加载设置数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, []); // 移除依赖项，避免无限循环

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 保存配置
  const handleSaveConfig = useCallback(async () => {
    setSaving(true);
    setSaveResult(null);

    try {
      await apiClient.updateConfig(config as unknown as Record<string, unknown>);
      setSaveResult({
        success: true,
        message: '配置保存成功'
      });
    } catch (error) {
      console.error('保存配置失败:', error);
      setSaveResult({
        success: false,
        message: '保存配置失败，请重试'
      });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveResult(null), 3000);
    }
  }, [config]);

  // 保存安全配置
  const handleSaveSecurityConfig = useCallback(async () => {
    setSavingSecurityConfig(true);
    setSecuritySaveResult(null);

    try {
      // 如果配置了安全参数，同时设置WebSocket安全配置
      if (securityConfig.customHeaderKey.trim() && securityConfig.customHeaderValue.trim()) {
        await apiClient.setWebSocketSecurity(
          securityConfig.customHeaderKey.trim(),
          securityConfig.customHeaderValue.trim()
        );
        setSecuritySaveResult({
          success: true,
          message: '安全配置保存成功，WebSocket连接安全验证已更新并持久化'
        });
      } else {
        // 如果清空了配置，也清除WebSocket安全配置
        await apiClient.clearWebSocketSecurity();
        setSecuritySaveResult({
          success: true,
          message: '安全配置已清除，WebSocket连接验证已禁用'
        });
      }

      // 安全配置保存到本地存储，通过zustand的persist中间件自动保存
    } catch (error) {
      console.error('保存安全配置失败:', error);
      setSecuritySaveResult({
        success: false,
        message: '保存安全配置失败，请重试'
      });
    } finally {
      setSavingSecurityConfig(false);
      setTimeout(() => setSecuritySaveResult(null), 3000);
    }
  }, [securityConfig]);

  // 清理过期内容
  const handleCleanup = useCallback(async () => {
    setCleaning(true);
    setCleanupResult(null);

    try {
      const beforeDate = new Date();
      beforeDate.setDate(beforeDate.getDate() - config.autoCleanupDays);

      const result = await apiClient.cleanupExpiredItems({
        maxCount: config.maxItems,
        beforeDate: beforeDate.toISOString()
      });

      setCleanupResult({
        success: true,
        message: `清理完成，删除了 ${result.deletedCount} 项内容`,
        deletedCount: result.deletedCount
      });

      // 重新加载统计数据
      const newStats = await apiClient.getStorageStats();
      setStorageStats(newStats);
    } catch (error) {
      console.error('清理失败:', error);
      setCleanupResult({
        success: false,
        message: '清理失败，请重试'
      });
    } finally {
      setCleaning(false);
      setTimeout(() => setCleanupResult(null), 5000);
    }
  }, [config.autoCleanupDays, config.maxItems]);

  // 清空所有内容
  const handleClearAll = useCallback(async () => {
    if (!window.confirm('确定要清空所有内容吗？此操作不可恢复！')) {
      return;
    }

    setClearing(true);
    setClearResult(null);

    try {
      const result = await apiClient.clearAllItems();

      setClearResult({
        success: true,
        message: `已清空所有内容，删除了 ${result.deletedCount} 个项目`,
        deletedCount: result.deletedCount
      });

      // 重新加载统计数据
      const newStats = await apiClient.getStorageStats();
      setStorageStats(newStats);
    } catch (error) {
      console.error('清空所有内容失败:', error);
      setClearResult({
        success: false,
        message: '清空所有内容失败，请重试'
      });
    } finally {
      setClearing(false);
      setTimeout(() => setClearResult(null), 5000);
    }
  }, []);

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载设置中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>返回主页</span>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                设置
              </h1>
              <p className="text-gray-600">
                查看存储统计、配置清理策略和管理内容
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>刷新</span>
          </button>
        </div>

        {/* 存储统计 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <Database className="w-5 h-5" />
            <span>存储统计</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <HardDrive className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">总计</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{storageStats.totalItems}</div>
              <div className="text-sm text-blue-600">项内容</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-medium text-green-900">文字</span>
              </div>
              <div className="text-2xl font-bold text-green-900">{storageStats.textItems}</div>
              <div className="text-sm text-green-600">项内容</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-medium text-purple-900">图片</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">{storageStats.imageItems}</div>
              <div className="text-sm text-purple-600">项内容</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-sm font-medium text-orange-900">大小</span>
              </div>
              <div className="text-2xl font-bold text-orange-900">{storageStats.totalSize}</div>
              <div className="text-sm text-orange-600">存储空间</div>
            </div>
          </div>
        </div>
        {/* 安全配置 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>安全配置</span>
          </h2>

          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Key className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900 mb-1">自定义请求头</h3>
                  <p className="text-sm text-blue-700">
                    配置后，所有API请求都会自动附加此请求头，可用于nginx等反向代理的安全验证
                  </p>
                </div>
              </div>
            </div>

            {/* 请求头Key */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                请求头名称 (Header Key)
              </label>
              <input
                type="text"
                placeholder="例如: X-API-Key"
                value={securityConfig.customHeaderKey}
                onChange={(e) => setSecurityConfig({ customHeaderKey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">请求头的名称，建议使用 X- 开头的自定义头</p>
            </div>

            {/* 请求头Value */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                请求头值 (Header Value)
              </label>
              <input
                type="password"
                placeholder="请输入安全密钥"
                value={securityConfig.customHeaderValue}
                onChange={(e) => setSecurityConfig({ customHeaderValue: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">请求头的值，建议使用复杂的随机字符串</p>
            </div>

            {/* 保存按钮 */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleSaveSecurityConfig}
                disabled={savingSecurityConfig}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                  savingSecurityConfig
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{savingSecurityConfig ? '保存中...' : '保存安全配置'}</span>
              </button>
            </div>
          </div>
        </div>





        {/* 清理策略 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>清理策略</span>
          </h2>

          <div className="space-y-6">
            {/* 最大条目数 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                最大保存条目数
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                value={config.maxItems}
                onChange={(e) => setConfig(prev => ({ ...prev, maxItems: parseInt(e.target.value) || 1000 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">超过此数量时将自动删除最旧的内容</p>
            </div>

            {/* 自动清理天数 */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                自动清理天数
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={config.autoCleanupDays}
                onChange={(e) => setConfig(prev => ({ ...prev, autoCleanupDays: parseInt(e.target.value) || 30 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">自动删除超过指定天数的内容</p>
            </div>

            {/* 操作按钮 */}
            <div className="pt-4 border-t border-gray-200 space-y-4">
              <div>
                <button
                  onClick={handleCleanup}
                  disabled={cleaning}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                    cleaning
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-orange-600 text-white hover:bg-orange-700'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{cleaning ? '清理中...' : '立即清理过期内容'}</span>
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  将删除超过 {config.autoCleanupDays} 天的内容，并保留最新的 {config.maxItems} 项
                </p>
              </div>

              <div>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors duration-200 ${
                    clearing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{clearing ? '清空中...' : '清空所有内容'}</span>
                </button>
                <p className="text-sm text-red-600 mt-2">
                  ⚠️ 危险操作：将删除所有剪切板内容，此操作不可恢复！
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 操作结果提示 */}
        {(saveResult || securitySaveResult || cleanupResult || clearResult) && (
          <div className={`rounded-lg p-4 mb-6 ${
            (saveResult?.success || securitySaveResult?.success || cleanupResult?.success || clearResult?.success)
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              {(saveResult?.success || securitySaveResult?.success || cleanupResult?.success || clearResult?.success) ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${
                (saveResult?.success || securitySaveResult?.success || cleanupResult?.success || clearResult?.success) ? 'text-green-800' : 'text-red-800'
              }`}>
                {saveResult?.message || securitySaveResult?.message || cleanupResult?.message || clearResult?.message}
              </span>
            </div>
          </div>
        )}

        {/* 保存按钮 */}
        <div className="flex justify-center">
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-medium transition-colors duration-200 ${
              saving
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Save className="w-5 h-5" />
            <span>{saving ? '保存中...' : '保存设置'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}