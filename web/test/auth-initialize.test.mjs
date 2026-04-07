import test from "node:test";
import assert from "node:assert/strict";

import { retryAuthInitialization } from "../src/contexts/auth-initialize.ts";

test("retries auth initialization with exponential backoff before succeeding", async () => {
  const delays = [];
  let attempts = 0;

  const result = await retryAuthInitialization({
    operation: async () => {
      attempts += 1;
      if (attempts < 4) {
        throw new Error(`transient failure ${attempts}`);
      }
      return "ok";
    },
    sleep: async (delayMs) => {
      delays.push(delayMs);
    },
  });

  assert.equal(result, "ok");
  assert.equal(attempts, 4);
  assert.deepEqual(delays, [500, 1000, 2000]);
});

test("throws the final error after exhausting auth initialization retries", async () => {
  const delays = [];
  let attempts = 0;

  await assert.rejects(
    () =>
      retryAuthInitialization({
        operation: async () => {
          attempts += 1;
          throw new Error(`transient failure ${attempts}`);
        },
        sleep: async (delayMs) => {
          delays.push(delayMs);
        },
      }),
    /transient failure 4/,
  );

  assert.equal(attempts, 4);
  assert.deepEqual(delays, [500, 1000, 2000]);
});
