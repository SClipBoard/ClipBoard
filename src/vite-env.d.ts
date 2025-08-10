/// <reference types="vite/client" />

// 扩展全局File构造函数
declare global {
  interface FileConstructor {
    new(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag): File;
  }
}