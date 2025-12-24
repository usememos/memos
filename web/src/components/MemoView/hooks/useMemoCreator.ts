import { useUser } from "@/hooks/useUserQueries";

export const useMemoCreator = (creatorName: string) => {
  const { data: creator } = useUser(creatorName);
  return creator;
};
