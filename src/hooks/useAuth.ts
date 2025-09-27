import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backend } from "../lib/backend";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: () => backend.auth.getCurrentUser(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const requestOTPMutation = useMutation({
    mutationFn: (phone: string) => backend.auth.requestPhoneOTP(phone),
  });

  const verifyOTPMutation = useMutation({
    mutationFn: ({ userId, code }: { userId: string; code: string }) =>
      backend.auth.verifyOTP({ userId, code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    },
  });

  const emailLoginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      backend.auth.createEmailSession(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => backend.auth.logout(),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "user"], null);
      queryClient.clear();
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    requestOTP: requestOTPMutation.mutateAsync,
    verifyOTP: verifyOTPMutation.mutateAsync,
    emailLogin: emailLoginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isRequestingOTP: requestOTPMutation.isPending,
    isVerifyingOTP: verifyOTPMutation.isPending,
    isLoggingIn: emailLoginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    otpError: requestOTPMutation.error,
    verifyError: verifyOTPMutation.error,
    loginError: emailLoginMutation.error,
  };
}
