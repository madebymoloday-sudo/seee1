import { useAuth } from "@/hooks/useAuth";
import { observer } from "mobx-react-lite";
import { Link, Outlet } from "react-router-dom";

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout = observer(({ children }: LayoutProps) => {
  useAuth();

  return (
    <div className="h-svh bg-background ">
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            <Link
              to="/sessions/list"
              className="flex items-center space-x-2 text-xl font-bold text-foreground dark:text-white hover:opacity-90"
            >
              <img
                src="/seee-logo-128.png"
                alt="Seee"
                className="h-10 w-10 rounded-full"
                draggable={false}
              />
              <span>Seee</span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="h-dvh">{children || <Outlet />}</main>
    </div>
  );
});
