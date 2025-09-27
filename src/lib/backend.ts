import { Backend } from "./types";
import { createLocalBackend } from "./localBackend";
import { createAppwriteBackend } from "./appwrite";

const USE_LOCAL_DB = import.meta.env.VITE_USE_LOCALDB !== "false";

export const backend: Backend = USE_LOCAL_DB
  ? createLocalBackend()
  : createAppwriteBackend();

export const isLocalMode = USE_LOCAL_DB;
