import { useAuth } from "@/hooks/useAuth";
import { observer } from "mobx-react-lite";
import { Link, Outlet } from "react-router-dom";

interface LayoutProps {
  children?: React.ReactNode;
  lockMainScroll?: boolean;
}

export const Layout = observer(
  ({ children, lockMainScroll = false }: LayoutProps) => {
    useAuth();

    return (
      <div
        className="bg-background flex min-h-0 flex-col"
        style={{ height: "var(--app-viewport-height, 100dvh)" }}
      >
        <nav
          className="bg-background/92 border-b border-border shrink-0 sticky top-0 z-[10020] backdrop-blur-xl"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="mx-auto w-full max-w-[1480px] px-4">
            <div className="flex h-14 items-center">
              <Link
                to="/sessions/list"
                className="flex items-center gap-2.5 text-lg font-[760] tracking-[-0.04em] text-foreground transition-opacity hover:opacity-65"
              >
                <img
                  src="/seee-logo-128.png"
                  alt="Seee"
                  className="h-8 w-8 rounded-full border border-border bg-card"
                  draggable={false}
                />
                <span>Seee</span>
              </Link>
            </div>
          </div>
        </nav>

        <main
          className={`flex-1 min-h-0 overflow-x-hidden ${
            lockMainScroll ? "overflow-hidden" : "overflow-y-auto"
          }`}
        >
          {children || <Outlet />}
        </main>
      </div>
    );
  },
);
