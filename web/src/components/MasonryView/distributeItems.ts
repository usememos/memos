import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { DistributionResult } from "./types";

export function distributeItemsToColumns(
  memos: Memo[],
  columns: number,
  itemHeights: Map<string, number>,
  prefixElementHeight: number = 0,
): DistributionResult {
  if (columns === 1) {
    const totalHeight = memos.reduce((sum, memo) => sum + (itemHeights.get(memo.name) || 0), prefixElementHeight);
    return {
      distribution: [Array.from({ length: memos.length }, (_, i) => i)],
      columnHeights: [totalHeight],
    };
  }

  const distribution: number[][] = Array.from({ length: columns }, () => []);
  const columnHeights: number[] = Array(columns).fill(0);
  const columnCounts: number[] = Array(columns).fill(0);

  if (prefixElementHeight > 0) {
    columnHeights[0] = prefixElementHeight;
  }

  let startIndex = 0;

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

    const shortestColumnIndex = findShortestColumnIndex(columnHeights, columnCounts);

    distribution[shortestColumnIndex].push(i);
    columnHeights[shortestColumnIndex] += height;
    columnCounts[shortestColumnIndex] += 1;
  }

  return { distribution, columnHeights };
}

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

    if (currentHeight === minHeight && columnCounts[i] < columnCounts[minIndex]) {
      minIndex = i;
    }
  }

  return minIndex;
}
