import { logoutServerFn } from "@/lib/auth/auth.functions";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/logout")({
  component: LogoutPage,
});

function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    logoutServerFn().then(() => {
      router.navigate({ to: "/sign-in" });
    });
  }, [router]);

  return <div>Logging out...</div>;
}
