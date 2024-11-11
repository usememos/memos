import { create } from "zustand";
import { combine } from "zustand/middleware";
import { nestServiceClient } from "@/grpcweb";
import { CreateNestRequest, Nest, UpdateNestRequest } from "@/types/proto/api/v1/nest_service";

interface State {
  nestMapByName: Record<string, Nest>;
}

const getDefaultState = (): State => ({
  nestMapByName: {},
});

export const useNestStore = create(
  combine(getDefaultState(), (set, get) => ({
    setState: (state: State) => set(state),
    getState: () => get(),
    fetchNests: async () => {
      const { nests } = await nestServiceClient.listNests({});
      const nestMap = get().nestMapByName;
      for (const nest of nests) {
        nestMap[nest.name] = nest;
      }
      set({ nestMapByName: nestMap });
      return nestMap
    },
    getNestByName: (name: string) => {
      const nestMap = get().nestMapByName;
      return Object.values(nestMap).find((r) => r.name === name);
    },
    async createNest(create: CreateNestRequest): Promise<Nest> {
      const nest = await nestServiceClient.createNest(create);
      const nestMap = get().nestMapByName;
      nestMap[nest.name] = nest;
      return nest;
    },
    async updateNest(update: UpdateNestRequest): Promise<Nest> {
      const nest = await nestServiceClient.updateNest(update);
      const nestMap = get().nestMapByName;
      nestMap[nest.name] = nest;
      return nest;
    },
  })),
);

export const useNestList = () => {
  const nestStore = useNestStore();
  const nests = Object.values(nestStore.getState().nestMapByName);

  return nests
};
