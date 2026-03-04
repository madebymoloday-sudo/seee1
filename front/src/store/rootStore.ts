import { makeAutoObservable } from "mobx";
import AuthStore from "./auth/authStore";
import SessionsStore from "./sessions/sessionsStore";
import UiStore from "./ui/uiStore";

export class RootStore {
  auth: AuthStore;
  sessions: SessionsStore;
  ui: UiStore;

  constructor() {
    this.auth = new AuthStore(this);
    this.sessions = new SessionsStore(this);
    this.ui = new UiStore(this);

    makeAutoObservable(this, {}, { autoBind: true });
  }
}

export const rootStore = new RootStore();

// Context для React
import { createContext, useContext } from "react";

export const RootStoreContext = createContext<RootStore | null>(null);

export const useStore = () => {
  const store = useContext(RootStoreContext);
  if (!store) {
    throw new Error("useStore must be used within RootStoreProvider");
  }
  return store;
};

