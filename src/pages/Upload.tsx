import { useState, useRef, useCallback } from 'react';
import { Upload as UploadIcon, Image, FileText, File, X, Check, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiClient } from '../lib/api';
import { deviceId } from '../lib/websocket';
import type { ClipboardItem } from '../../shared/types';

type UploadType = 'text' | 'image' | 'file';

interface UploadResult {
  success: boolean;
  item?: ClipboardItem;
  error?: string;
}

export default function Upload() {
  const [uploadType, setUploadType] = useState<UploadType>('text');
  const [textContent, setTextContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generalFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 处理文件选择
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setUploadResult({
        success: false,
        error: '请选择图片文件'
      });
      return;
    }

    // 移除文件大小限制
    // 注意：现在支持任意大小的文件上传

    setImageFile(file);
    setUploadResult(null);

    // 生成预览
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // 处理拖拽上传
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setImageFile(file);
        setUploadResult(null);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setUploadResult({
          success: false,
          error: '请拖拽图片文件'
        });
      }
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  // 处理一般文件选择
  const handleGeneralFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 移除文件大小限制
    // 注意：现在支持任意大小的文件上传

    setSelectedFile(file);
    setUploadResult(null);
  }, []);

  // 清除图片
  const clearImage = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // 清除文件
  const clearFile = useCallback(() => {
    setSelectedFile(null);
    if (generalFileInputRef.current) {
      generalFileInputRef.current.value = '';
    }
  }, []);

  // 处理上传
  const handleUpload = useCallback(async () => {
    if (uploading) return;

    const uploadData: {
      type: 'text' | 'image' | 'file';
      content: string;
      deviceId: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
    } = {
      type: uploadType,
      content: '',
      deviceId
    };
    
    if (uploadType === 'text') {
      if (!textContent.trim()) {
        setUploadResult({
          success: false,
          error: '请输入文字内容'
        });
        return;
      }
      uploadData.content = textContent.trim();
    } else if (uploadType === 'image') {
      if (!imageFile || !imagePreview) {
        setUploadResult({
          success: false,
          error: '请选择图片文件'
        });
        return;
      }

      // 使用新的文件上传API
      try {
        const item = await apiClient.uploadFile(imageFile, 'image', deviceId);
        setUploadResult({
          success: true,
          item
        });
        clearImage();
        setUploading(false);
        return;
      } catch (error) {
        console.error('图片上传失败:', error);
        setUploadResult({
          success: false,
          error: error instanceof Error ? error.message : '图片上传失败，请重试'
        });
        setUploading(false);
        return;
      }
    } else if (uploadType === 'file') {
      if (!selectedFile) {
        setUploadResult({
          success: false,
          error: '请选择文件'
        });
        return;
      }

      // 使用新的文件上传API
      try {
        const item = await apiClient.uploadFile(selectedFile, 'file', deviceId);
        setUploadResult({
          success: true,
          item
        });
        clearFile();
        setUploading(false);
        return;
      } catch (error) {
        console.error('文件上传失败:', error);
        setUploadResult({
          success: false,
          error: error instanceof Error ? error.message : '文件上传失败，请重试'
        });
        setUploading(false);
        return;
      }
    }

    // 只有文本类型走这里，文件和图片已经在上面处理了
    if (uploadType === 'text') {
      setUploading(true);
      setUploadResult(null);

      try {
        const item = await apiClient.createClipboardItem(uploadData);

        setUploadResult({
          success: true,
          item
        });

        // 清空表单
        setTextContent('');

      } catch (error) {
        console.error('上传失败:', error);
        setUploadResult({
          success: false,
          error: error instanceof Error ? error.message : '上传失败，请重试'
        });
      } finally {
        setUploading(false);
      }
    }
  }, [uploadType, textContent, imageFile, imagePreview, selectedFile, uploading, clearImage, clearFile]);

  // 从剪切板粘贴
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const clipboardItem of clipboardItems) {
        // 检查是否有图片
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const file = new (File as any)([blob], 'clipboard-image.png', { type });
            
            setUploadType('image');
            setImageFile(file);
            
            const reader = new FileReader();
            reader.onload = (e) => {
              setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
            return;
          }
        }
        
        // 检查是否有文字
        if (clipboardItem.types.includes('text/plain')) {
          const text = await navigator.clipboard.readText();
          if (text.trim()) {
            setUploadType('text');
            setTextContent(text);
            return;
          }
        }
      }
      
      setUploadResult({
        success: false,
        error: '剪切板中没有可用的内容'
      });
    } catch (error) {
      console.error('读取剪切板失败:', error);
      setUploadResult({
        success: false,
        error: '无法读取剪切板内容，请检查浏览器权限'
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link
              to="/"
              className="flex items-center space-x-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>返回主页</span>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            上传内容
          </h1>
          <p className="text-gray-600">
            上传文字或图片到剪切板同步
          </p>
        </div>

        {/* 类型选择 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">选择内容类型</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setUploadType('text')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg border-2 transition-colors duration-200 ${
                uploadType === 'text'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span className="font-medium">文字内容</span>
            </button>
            <button
              onClick={() => setUploadType('image')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg border-2 transition-colors duration-200 ${
                uploadType === 'image'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <Image className="w-5 h-5" />
              <span className="font-medium">图片内容</span>
            </button>
            <button
              onClick={() => setUploadType('file')}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg border-2 transition-colors duration-200 ${
                uploadType === 'file'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <File className="w-5 h-5" />
              <span className="font-medium">文件内容</span>
            </button>
          </div>
        </div>

        {/* 内容输入区域 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          {uploadType === 'text' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                文字内容
              </label>
              <textarea
                ref={textareaRef}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                placeholder="请输入要上传的文字内容..."
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-500">
                  {textContent.length} 字符
                </span>
                <button
                  onClick={handlePasteFromClipboard}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  从剪切板粘贴
                </button>
              </div>
            </div>
          ) : uploadType === 'image' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                图片文件
              </label>
              
              {!imagePreview ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors duration-200 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    点击选择图片或拖拽到此处
                  </p>
                  <p className="text-sm text-gray-500">
                    支持 JPG、PNG、GIF 等所有图片格式，无大小限制
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="预览图片"
                    className="w-full max-h-80 object-contain rounded-lg border border-gray-200"
                  />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="mt-2 text-sm text-gray-500">
                    文件名: {imageFile?.name}<br />
                    文件大小: {imageFile ? (imageFile.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
                  </div>
                </div>
              )}
              
              <div className="mt-4">
                <button
                  onClick={handlePasteFromClipboard}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  从剪切板粘贴图片
                </button>
              </div>
            </div>
          ) : uploadType === 'file' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                文件上传
              </label>
              
              {!selectedFile ? (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors duration-200 cursor-pointer"
                  onClick={() => generalFileInputRef.current?.click()}
                >
                  <UploadIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    点击选择文件
                  </p>
                  <p className="text-sm text-gray-500">
                    支持文档、压缩包、视频、音频等所有格式，无大小限制
                  </p>
                  <input
                    ref={generalFileInputRef}
                    type="file"
                    onChange={handleGeneralFileSelect}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <File className="w-8 h-8 text-blue-500" />
                      <div>
                        <p className="font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || '未知类型'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={clearFile}
                      className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors duration-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded p-3">
                    <p className="text-sm text-gray-600">
                      <strong>文件信息：</strong><br />
                      类型：{selectedFile.type || '未知'}<br />
                      大小：{selectedFile.size.toLocaleString()} 字节<br />
                      最后修改：{new Date(selectedFile.lastModified).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* 上传结果 */}
        {uploadResult && (
          <div className={`rounded-lg p-4 mb-6 ${
            uploadResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center space-x-2">
              {uploadResult.success ? (
                <Check className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${
                uploadResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {uploadResult.success ? '上传成功！' : '上传失败'}
              </span>
            </div>
            {uploadResult.error && (
              <p className="mt-1 text-sm text-red-600">
                {uploadResult.error}
              </p>
            )}
            {uploadResult.success && uploadResult.item && (
              <p className="mt-1 text-sm text-green-600">
                内容已添加到剪切板同步，ID: {uploadResult.item.id.slice(-8)}
              </p>
            )}
          </div>
        )}

        {/* 上传按钮 */}
        <div className="flex justify-center">
          <button
            onClick={handleUpload}
            disabled={uploading || (
              uploadType === 'text' ? !textContent.trim() :
              uploadType === 'image' ? !imageFile :
              uploadType === 'file' ? !selectedFile :
              true
            )}
            className={`flex items-center space-x-2 px-8 py-3 rounded-lg font-medium transition-colors duration-200 ${
              uploading || (
                uploadType === 'text' ? !textContent.trim() :
                uploadType === 'image' ? !imageFile :
                uploadType === 'file' ? !selectedFile :
                true
              )
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <UploadIcon className="w-5 h-5" />
            <span>{uploading ? '上传中...' : '上传到剪切板'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}