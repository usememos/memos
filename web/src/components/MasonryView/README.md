# MasonryView - Height-Based Masonry Layout

## Overview

This improved MasonryView component implements a true masonry layout that distributes memo cards based on their actual rendered heights, creating a balanced waterfall-style layout instead of naive sequential distribution.

## Key Features

### 1. Height Measurement

- **MemoItem Wrapper**: Each memo is wrapped in a `MemoItem` component that measures its actual height
- **ResizeObserver**: Automatically detects height changes when content changes (e.g., images load, content expands)
- **Real-time Updates**: Heights are measured on mount and updated dynamically

### 2. Smart Distribution Algorithm

- **Shortest Column First**: Memos are assigned to the column with the smallest total height
- **Dynamic Balancing**: As new memos are added or heights change, the layout rebalances
- **Prefix Element Support**: Properly accounts for the MemoEditor height in the first column

### 3. Performance Optimizations

- **Memoized Callbacks**: `handleHeightChange` is memoized to prevent unnecessary re-renders
- **Efficient State Updates**: Only redistributes when necessary (memo list changes, column count changes)
- **ResizeObserver Cleanup**: Properly disconnects observers to prevent memory leaks

## Architecture

```
MasonryView
├── State Management
│   ├── columns: number of columns based on viewport width
│   ├── itemHeights: Map<memoName, height> for each memo
│   ├── columnHeights: current total height of each column
│   └── distribution: which memos belong to which column
├── MemoItem (for each memo)
│   ├── Ref for height measurement
│   ├── ResizeObserver for dynamic updates
│   └── Callback to parent on height changes
└── Distribution Algorithm
    ├── Finds shortest column
    ├── Assigns memo to that column
    └── Updates column height tracking
```

## Usage

The component maintains the same API as before, so no changes are needed in consuming components:

```tsx
<MasonryView memoList={memos} renderer={(memo) => <MemoView memo={memo} />} prefixElement={<MemoEditor />} listMode={false} />
```

## Benefits vs Previous Implementation

### Before (Naive)

- Distributed memos by index: `memo[i % columns]`
- No consideration of actual heights
- Resulted in unbalanced columns
- Static layout that didn't adapt to content

### After (Height-Based)

- Distributes memos by actual rendered height
- Creates balanced columns with similar total heights
- Adapts to dynamic content changes
- Smoother visual layout

## Technical Implementation Details

### Height Measurement

```tsx
const measureHeight = () => {
  if (itemRef.current) {
    const height = itemRef.current.offsetHeight;
    onHeightChange(memo.name, height);
  }
};
```

### Distribution Algorithm

```tsx
const shortestColumnIndex = columnHeights.reduce(
  (minIndex, currentHeight, currentIndex) => (currentHeight < columnHeights[minIndex] ? currentIndex : minIndex),
  0,
);
```

### Dynamic Updates

- **Window Resize**: Recalculates column count and redistributes
- **Content Changes**: ResizeObserver triggers height remeasurement
- **Memo List Changes**: Redistributes all memos with new ordering

## Browser Support

- Modern browsers with ResizeObserver support
- Fallback behavior: Falls back to sequential distribution if ResizeObserver is not available
- CSS Grid support required for column layout

## Performance Considerations

1. **Initial Load**: Slight delay as heights are measured
2. **Memory Usage**: Stores height data for each memo
3. **Re-renders**: Optimized to only update when necessary
4. **Large Lists**: Scales well with proper virtualization (if needed in future)

## Future Enhancements

1. **Virtualization**: For very large memo lists
2. **Animation**: Smooth transitions when items change position
3. **Gap Optimization**: More sophisticated gap handling
4. **Estimated Heights**: Faster initial layout with height estimation
