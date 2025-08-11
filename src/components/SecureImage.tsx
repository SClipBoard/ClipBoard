import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../lib/api';

interface SecureImageProps {
  fileId: string;
  alt: string;
  className?: string;
  fileName?: string;
  onError?: () => void;
}

export default function SecureImage({ fileId, alt, className, fileName, onError }: SecureImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);

        // 获取图片数据
        const blob = await apiClient.getFilePreview(fileId, fileName);
        
        if (!isMounted) return;

        // 清理之前的URL
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
        }

        // 创建新的blob URL
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setImageUrl(url);
      } catch (err) {
        console.error('加载图片失败:', err);
        if (isMounted) {
          setError(true);
          onError?.();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
      // 清理blob URL
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [fileId, onError]);

  if (loading) {
    return (
      <div className={`bg-gray-100 animate-pulse rounded-lg flex items-center justify-center ${className || 'max-w-full max-h-32'}`}>
        <span className="text-gray-400 text-sm">加载中...</span>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`bg-gray-100 rounded-lg flex items-center justify-center ${className || 'max-w-full max-h-32'}`}>
        <span className="text-gray-500 text-sm">图片加载失败</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => {
        setError(true);
        onError?.();
      }}
    />
  );
}
