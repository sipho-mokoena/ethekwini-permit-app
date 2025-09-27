import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../hooks/useAuth";
import { isLocalMode } from "../../lib/backend";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isLoggingIn, loginError, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.isAdmin) {
      navigate({ to: "/admin/applications" });
    } else if (user && !user.isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const result = await login({ email: email.trim(), password });

      if (result.user.isAdmin) {
        navigate({ to: "/admin/applications" });
      } else {
        setError("Access denied. Admin privileges required.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {isLocalMode && (
        <div className="dev-mode-warning">
          <strong>Development Mode:</strong> Use email "admin@local.test" and
          password "adminpass" to login as admin.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Admin Login</CardTitle>
          <CardDescription>Sign in with your admin credentials</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {(error || loginError) && (
              <p className="text-sm text-destructive">
                {error ||
                  (loginError instanceof Error
                    ? loginError.message
                    : "An error occurred")}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/login" })}
            >
              Back to User Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
