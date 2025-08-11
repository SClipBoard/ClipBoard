/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_PORT: string
  readonly VITE_WS_PORT: string
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// 扩展全局File构造函数
declare global {
  interface FileConstructor {
    new(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag): File;
  }
}