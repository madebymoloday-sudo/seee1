import { useStore } from "../store/rootStore";

export const useAuth = () => {
  const rootStore = useStore();
  return rootStore.auth;
};

