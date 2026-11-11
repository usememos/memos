import { argon2id } from "hash-wasm";

/** Protocol v1 fixes the KDF profile; untrusted records cannot increase its cost. */
export const deriveArgonKey = (password: string, salt: Uint8Array): Promise<Uint8Array> =>
  argon2id({ password, salt, parallelism: 4, iterations: 3, memorySize: 65536, hashLength: 32, outputType: "binary" });
