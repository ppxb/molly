/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_UPLOAD_MULTIPART_CONCURRENCY?: string
  readonly VITE_UPLOAD_MULTIPART_THRESHOLD?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
