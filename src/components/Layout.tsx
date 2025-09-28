import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { LogOut, Menu, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { isLocalMode } from "../lib/backend";
import { Button } from "./ui/Button";

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user && !location.href.includes("login")) window.location.href = "/login";
  }, [location, user])


  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      {!isOnline && (
        <div className="offline-banner">
          <WifiOff className="inline w-4 h-4 mr-2" />
          You are currently offline
        </div>
      )}

      <header className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-xl font-bold">
                Spaza Portal
              </Link>
              {isLocalMode && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  DEV MODE
                </span>
              )}
            </div>

            <div className="hidden md:flex items-center space-x-4">
              {user && (
                <>
                  {user.isAdmin ? (
                    <Link to="/admin/applications">
                      <Button variant="ghost">Applications</Button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/dashboard">
                        <Button variant="ghost">Dashboard</Button>
                      </Link>
                      <Link to="/apply">
                        <Button variant="ghost">Apply</Button>
                      </Link>
                    </>
                  )}
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </>
              )}
            </div>

            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {isMenuOpen && (
            <div className="md:hidden border-t py-4">
              {user && (
                <div className="space-y-2">
                  {user.isAdmin ? (
                    <Link to="/admin/applications">
                      <Button variant="ghost" className="w-full justify-start">
                        Applications
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/dashboard">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                        >
                          Dashboard
                        </Button>
                      </Link>
                      <Link to="/apply">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                        >
                          Apply
                        </Button>
                      </Link>
                    </>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="w-full justify-start"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
