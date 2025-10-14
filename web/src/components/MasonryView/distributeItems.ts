import { Memo } from "@/types/proto/api/v1/memo_service";
import { DistributionResult } from "./types";

/**
 * Distributes memos into columns using a height-aware greedy approach.
 *
 * Algorithm steps:
 * 1. Pin editor and first memo to the first column (keep feed stable)
 * 2. Place remaining memos into the currently shortest column
 * 3. Break height ties by preferring the column with fewer items
 *
 * @param memos - Array of memos to distribute
 * @param columns - Number of columns to distribute across
 * @param itemHeights - Map of memo names to their measured heights
 * @param prefixElementHeight - Height of prefix element (e.g., editor) in first column
 * @returns Distribution result with memo indices per column and column heights
 */
export function distributeItemsToColumns(
  memos: Memo[],
  columns: number,
  itemHeights: Map<string, number>,
  prefixElementHeight: number = 0,
): DistributionResult {
  // Single column mode: all memos in one column
  if (columns === 1) {
    const totalHeight = memos.reduce((sum, memo) => sum + (itemHeights.get(memo.name) || 0), prefixElementHeight);
    return {
      distribution: [Array.from({ length: memos.length }, (_, i) => i)],
      columnHeights: [totalHeight],
    };
  }

  // Initialize columns and their heights
  const distribution: number[][] = Array.from({ length: columns }, () => []);
  const columnHeights: number[] = Array(columns).fill(0);
  const columnCounts: number[] = Array(columns).fill(0);

  // Add prefix element height to first column
  if (prefixElementHeight > 0) {
    columnHeights[0] = prefixElementHeight;
  }

  let startIndex = 0;

  // Pin the first memo to the first column to keep top-of-feed stable
  if (memos.length > 0) {
    const firstMemoHeight = itemHeights.get(memos[0].name) || 0;
    distribution[0].push(0);
    columnHeights[0] += firstMemoHeight;
    columnCounts[0] += 1;
    startIndex = 1;
  }

  for (let i = startIndex; i < memos.length; i++) {
    const memo = memos[i];
    const height = itemHeights.get(memo.name) || 0;

    // Find column with minimum height
    const shortestColumnIndex = findShortestColumnIndex(columnHeights, columnCounts);

    distribution[shortestColumnIndex].push(i);
    columnHeights[shortestColumnIndex] += height;
    columnCounts[shortestColumnIndex] += 1;
  }

  return { distribution, columnHeights };
}

/**
 * Finds the index of the column with the minimum height
 * @param columnHeights - Array of column heights
 * @param columnCounts - Array of items per column (for tie-breaking)
 * @returns Index of the shortest column
 */
function findShortestColumnIndex(columnHeights: number[], columnCounts: number[]): number {
  let minIndex = 0;
  let minHeight = columnHeights[0];

  for (let i = 1; i < columnHeights.length; i++) {
    const currentHeight = columnHeights[i];
    if (currentHeight < minHeight) {
      minHeight = currentHeight;
      minIndex = i;
      continue;
    }

    // Tie-breaker: prefer column with fewer items to avoid stacking
    if (currentHeight === minHeight && columnCounts[i] < columnCounts[minIndex]) {
      minIndex = i;
    }
  }

  return minIndex;
}
