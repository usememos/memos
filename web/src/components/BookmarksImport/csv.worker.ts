/// <reference lib="webworker" />

import { parseRaindropCsv } from "./csv";

self.onmessage = (event: MessageEvent<string>) => {
  try {
    self.postMessage({ rows: parseRaindropCsv(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "CSV parsing failed" });
  }
};
