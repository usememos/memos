import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userServiceClient } from "@/connect";
import type { CreateEncryptionPasskeyRequest, DeleteEncryptionPasskeyRequest } from "@/types/proto/api/user_service_pb";

const passkeyKey = (owner: string) => ["encryptionPasskeys", owner] as const;
/** Query caches contain only credential locators and encrypted wrappers. */
export function useEncryptionPasskeys(owner: string) {
  return useQuery({
    queryKey: passkeyKey(owner),
    queryFn: () => userServiceClient.listEncryptionPasskeys({}),
    enabled: !!owner,
    retry: false,
  });
}
export function useCreateEncryptionPasskey(owner: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: Pick<CreateEncryptionPasskeyRequest, "passkey">) => userServiceClient.createEncryptionPasskey(request),
    onSuccess: () => client.invalidateQueries({ queryKey: passkeyKey(owner) }),
  });
}
export function useDeleteEncryptionPasskey(owner: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: Pick<DeleteEncryptionPasskeyRequest, "id">) => userServiceClient.deleteEncryptionPasskey(request),
    onSuccess: () => client.invalidateQueries({ queryKey: passkeyKey(owner) }),
  });
}
