"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json() as Promise<{ user: { email: string } | null }>)
      .then((d) => {
        if (d.user) {
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
          router.replace("/login");
        }
      })
      .catch(() => {
        setStatus("unauthenticated");
        router.replace("/login");
      });
  }, [router]);

  if (status === "loading") {
    return (
      <div className="auth-guard-loading">
        <Loader2 size={28} className="spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
}
