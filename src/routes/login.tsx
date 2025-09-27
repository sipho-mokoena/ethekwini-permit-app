import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useAuth } from "../hooks/useAuth";
import { isLocalMode } from "../lib/backend";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isLoggingIn, loginError, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.isAdmin) {
        navigate({ to: "/admin/applications" });
      } else {
        navigate({ to: "/dashboard" });
      }
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
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {isLocalMode && (
        <div className="dev-mode-warning">
          <strong>Development Mode:</strong> Use email "admin@local.test" and
          password "adminpass" for the seeded admin account.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Enter your email and password to continue
          </CardDescription>
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
            <p className="text-sm text-muted-foreground mb-3">
              Don&apos;t have an account?
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: "/register" })}
            >
              Create an account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
