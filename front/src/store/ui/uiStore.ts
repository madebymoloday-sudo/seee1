import { makeAutoObservable } from "mobx";
import { RootStore } from "../rootStore";

export default class UiStore {
  rootStore: RootStore;
  sidebarOpen = true;
  theme: "light" | "dark" = "light";

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  setSidebarOpen(open: boolean) {
    this.sidebarOpen = open;
  }

  toggleTheme() {
    this.theme = this.theme === "light" ? "dark" : "light";
  }
}

