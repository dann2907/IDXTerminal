/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_FORMAT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

