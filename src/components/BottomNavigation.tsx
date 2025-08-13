import { Home, Upload, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export default function BottomNavigation() {
  const location = useLocation();

  const navItems = [
    {
      path: '/',
      icon: Home,
      label: '首页',
      isActive: location.pathname === '/'
    },
    {
      path: '/upload',
      icon: Upload,
      label: '上传',
      isActive: location.pathname === '/upload'
    },
    {
      path: '/settings',
      icon: Settings,
      label: '设置',
      isActive: location.pathname === '/settings'
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 safe-area-inset-bottom">
      <div className="flex items-center justify-around py-2 pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center py-3 px-4 min-w-0 flex-1 transition-colors duration-200 ${
                item.isActive
                  ? 'text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 active:text-blue-500'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 transition-colors duration-200 ${
                item.isActive ? 'text-blue-600' : 'text-gray-500'
              }`} />
              <span className={`text-xs font-medium transition-colors duration-200 leading-tight ${
                item.isActive ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
