import { useAuth as useSessionAuth } from "@/lib/auth-context";

export function useAuth() {
  const { user, isLoading, logout } = useSessionAuth();
  return {
    isLoaded: !isLoading,
    isSignedIn: !!user,
    userId: user ? String(user.id) : null,
    getToken: async (): Promise<string | null> => null,
    signOut: logout,
  };
}

export function useUser() {
  const { user, isLoading } = useSessionAuth();
  const clerkUser = user
    ? {
        id: String(user.id),
        firstName: user.username ?? null,
        fullName: user.username ?? null,
        username: user.username ?? null,
        emailAddresses: [{ emailAddress: user.email }],
        primaryEmailAddress: { emailAddress: user.email },
        imageUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.username ?? "U")}`,
        phoneNumbers: [] as Array<{ phoneNumber: string }>,
        unsafeMetadata: {} as Record<string, unknown>,
        update: async (_data: Record<string, unknown>): Promise<void> => {},
      }
    : null;
  return {
    isLoaded: !isLoading,
    isSignedIn: !!user,
    user: clerkUser,
  };
}

export function useClerk() {
  const { logout } = useSessionAuth();
  return {
    signOut: logout,
    addListener: (_fn: unknown) => () => {},
  };
}
