import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SecurityConfig } from './config';

interface SecurityStore {
  config: SecurityConfig;
  setConfig: (config: Partial<SecurityConfig>) => void;
  clearConfig: () => void;
  getHeaders: () => Record<string, string>;
}

const defaultConfig: SecurityConfig = {
  customHeaderKey: '',
  customHeaderValue: '',
};

export const useSecurityStore = create<SecurityStore>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      
      setConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig },
        }));
      },
      
      clearConfig: () => {
        set({ config: defaultConfig });
      },
      
      getHeaders: () => {
        const { config } = get();
        const headers: Record<string, string> = {};
        
        // 只有当key和value都不为空时才添加自定义请求头
        if (config.customHeaderKey.trim() && config.customHeaderValue.trim()) {
          headers[config.customHeaderKey.trim()] = config.customHeaderValue.trim();
        }
        
        return headers;
      },
    }),
    {
      name: 'security-config',
      // 只持久化配置，不持久化方法
      partialize: (state) => ({ config: state.config }),
    }
  )
);
