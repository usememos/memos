import { deriveArgonKey } from "./kdf";

self.onmessage = async ({ data }: MessageEvent<{ password: string; salt: Uint8Array }>) => {
  try {
    const key = await deriveArgonKey(data.password, data.salt);
    self.postMessage({ key });
    key.fill(0);
  } catch {
    self.postMessage({ error: true });
  }
};
