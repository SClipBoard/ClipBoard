import { ReactNode } from 'react';
import BottomNavigation from './BottomNavigation';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 主要内容区域 */}
      <div className="pb-20 md:pb-0">
        {children}
      </div>

      {/* 移动端底部导航栏 */}
      <BottomNavigation />
    </div>
  );
}
