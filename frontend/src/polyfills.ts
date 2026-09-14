import { Buffer } from "buffer";

declare global {
  interface Window {
    Buffer: typeof Buffer;
    global: typeof globalThis;
  }
}

if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer;
  window.global = window.global || window;
  if (!(window as unknown as { process?: unknown }).process) {
    (window as unknown as { process: unknown }).process = { env: {} };
  }
}

if (typeof globalThis !== "undefined") {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer =
    (globalThis as unknown as { Buffer: typeof Buffer }).Buffer || Buffer;
  (globalThis as unknown as { global: typeof globalThis }).global =
    (globalThis as unknown as { global: typeof globalThis }).global || globalThis;
  if (!(globalThis as unknown as { process?: unknown }).process) {
    (globalThis as unknown as { process: unknown }).process = { env: {} };
  }
}
