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
import { isValidPhoneNumber } from "../lib/utils";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const { requestOTP, isRequestingOTP, otpError, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!cooldownUntil) return;

    const interval = window.setInterval(() => {
      if (cooldownUntil <= Date.now()) {
        setCooldownUntil(null);
        window.clearInterval(interval);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [cooldownUntil]);

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

    if (!isValidPhoneNumber(phone)) {
      setError("Please enter a valid South African phone number");
      return;
    }

    try {
      const result = await requestOTP(phone);

      if (result.ok) {
        if (!result.userId) {
          setError("Failed to start verification. Please try again");
          return;
        }
        navigate({
          to: "/verify",
          search: { phone, userId: result.userId },
        });
      } else if (result.cooldownUntil) {
        const remainingTime = Math.ceil(
          (result.cooldownUntil - Date.now()) / 1000,
        );
        setCooldownUntil(result.cooldownUntil);
        setError(
          `Please wait ${remainingTime} seconds before requesting another OTP`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {isLocalMode && (
        <div className="dev-mode-warning">
          <strong>Development Mode:</strong> You are using local storage. Use
          any valid SA phone number and OTP code "123456".
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Login with Phone</CardTitle>
          <CardDescription>
            Enter your phone number to receive an OTP
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="tel"
                placeholder="Phone number (e.g., 0821234567)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            {cooldownUntil && (
              <p className="text-xs text-muted-foreground">
                You can request another code in
                {` ${Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000))} `}
                seconds.
              </p>
            )}

            {(error || otpError) && (
              <p className="text-sm text-destructive">
                {error ||
                  (otpError instanceof Error
                    ? otpError.message
                    : "An error occurred")}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isRequestingOTP}>
              {isRequestingOTP ? "Sending OTP..." : "Send OTP"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground text-center mb-4">
              Official access
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: "/admin/login" })}
            >
              Admin Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
