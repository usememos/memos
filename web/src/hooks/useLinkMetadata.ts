import { create } from "@bufbuild/protobuf";
import { useQuery } from "@tanstack/react-query";
import { linkServiceClient } from "@/connect";
import type { LinkMetadata } from "@/types/proto/api/v1/link_service_pb";
import { GetLinkMetadataRequestSchema } from "@/types/proto/api/v1/link_service_pb";

// Query keys factory for link metadata
export const linkMetadataKeys = {
  all: ["linkMetadata"] as const,
  detail: (url: string) => [...linkMetadataKeys.all, "detail", url] as const,
};

/**
 * Fetches OpenGraph metadata for a given URL.
 * Results are cached per URL to avoid redundant fetches.
 */
export function useLinkMetadata(url: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: linkMetadataKeys.detail(url || ""),
    queryFn: async (): Promise<LinkMetadata> => {
      if (!url) {
        throw new Error("URL is required");
      }
      const response = await linkServiceClient.getLinkMetadata(create(GetLinkMetadataRequestSchema, { url }));
      return response;
    },
    enabled: options?.enabled !== false && url !== null && url !== "",
    staleTime: 1000 * 60 * 60, // Consider data fresh for 1 hour (link metadata doesn't change often)
    gcTime: 1000 * 60 * 60 * 24, // Keep unused data in cache for 24 hours
    retry: 2, // Retry failed requests up to 2 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
}
