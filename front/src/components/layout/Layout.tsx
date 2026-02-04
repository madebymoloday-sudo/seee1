import { observer } from "mobx-react-lite";
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Map,
  BookOpen,
  User,
  LogOut,
  Brain,
} from "lucide-react";

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout = observer(({ children }: LayoutProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card shadow-sm border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link
                to="/"
                className="flex items-center space-x-2 text-xl font-bold text-blue-600 hover:text-blue-700"
              >
                <Brain className="h-6 w-6" />
                <span>SEEE</span>
              </Link>
              <div className="flex items-center space-x-6">
                <Link
                  to="/sessions/list"
                  className={`flex items-center space-x-1.5 transition-colors ${
                    isActive("/sessions")
                      ? "text-blue-600 font-medium"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Сессии</span>
                </Link>
                <Link
                  to="/neuro"
                  className={`flex items-center space-x-1.5 transition-colors ${
                    isActive("/neuro")
                      ? "text-blue-600 font-medium"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  <Map className="h-4 w-4" />
                  <span>Нейрокарта</span>
                </Link>
                <Link
                  to="/journal"
                  className={`flex items-center space-x-1.5 transition-colors ${
                    isActive("/journal")
                      ? "text-blue-600 font-medium"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Журнал</span>
                </Link>
                <Link
                  to="/cabinet"
                  className={`flex items-center space-x-1.5 transition-colors ${
                    isActive("/cabinet")
                      ? "text-blue-600 font-medium"
                      : "text-foreground/80 hover:text-foreground"
                  }`}
                >
                  <User className="h-4 w-4" />
                  <span>Кабинет</span>
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-foreground/80">{user?.username || "Пользователь"}</span>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main>{children || <Outlet />}</main>
    </div>
  );
});

