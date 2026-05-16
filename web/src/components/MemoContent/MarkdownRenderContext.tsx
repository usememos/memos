import { createContext, useContext, useMemo } from "react";

interface MarkdownRenderContextValue {
  blockDepth: number;
}

export const rootMarkdownRenderContext: MarkdownRenderContextValue = {
  blockDepth: 0,
};

export const MarkdownRenderContext = createContext<MarkdownRenderContextValue>(rootMarkdownRenderContext);

export const useMarkdownRenderContext = () => {
  return useContext(MarkdownRenderContext);
};

export const NestedMarkdownRenderContext = ({ children }: { children: React.ReactNode }) => {
  const { blockDepth } = useMarkdownRenderContext();
  const value = useMemo<MarkdownRenderContextValue>(() => ({ blockDepth: blockDepth + 1 }), [blockDepth]);

  return <MarkdownRenderContext.Provider value={value}>{children}</MarkdownRenderContext.Provider>;
};
