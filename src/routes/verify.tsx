import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
  validateSearch: (search: Record<string, unknown>) => ({
    phone: search.phone as string,
    userId: typeof search.userId === "string" ? search.userId : undefined,
  }),
});

function VerifyPage() {
  const { phone, userId } = Route.useSearch();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const { verifyOTP, requestOTP, isVerifyingOTP, verifyError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    try {
      if (!userId) {
        setError("Missing verification info. Please request a new code.");
        return;
      }

      const result = await verifyOTP({ userId, code });

      if (result.user.isAdmin) {
        navigate({ to: "/admin/applications" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    }
  };

  const handleResend = async () => {
    try {
      const newToken = await requestOTP(phone);

      if (!newToken.ok) {
        if (newToken.cooldownUntil) {
          const seconds = Math.max(
            0,
            Math.ceil((newToken.cooldownUntil - Date.now()) / 1000),
          );
          setError(
            `Please wait ${seconds} seconds before requesting another OTP`,
          );
        }
        return;
      }

      const nextUserId = newToken.userId ?? userId;

      if (!nextUserId) {
        setError("Verification info missing. Please try again later.");
        return;
      }

      navigate({
        to: "/verify",
        search: { phone, userId: nextUserId },
      });
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend OTP");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      {isLocalMode && (
        <div className="dev-mode-warning">
          <strong>Development Mode:</strong> Use OTP code "123456" to verify.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Verify Phone Number</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to {phone}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Enter 6-digit code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
                required
              />
            </div>

            {(error || verifyError) && (
              <p className="text-sm text-destructive">
                {error ||
                  (verifyError instanceof Error
                    ? verifyError.message
                    : "An error occurred")}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isVerifyingOTP}>
              {isVerifyingOTP ? "Verifying..." : "Verify"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResend}
            >
              Resend Code
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
