/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPWRITE_ENDPOINT: string;
  readonly VITE_APPWRITE_PROJECT_ID: string;
  readonly VITE_APPWRITE_PROJECT_NAME?: string;
  readonly VITE_USE_LOCALDB?: string;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
