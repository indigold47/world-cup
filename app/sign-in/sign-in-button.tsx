"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

function GoogleMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.5 12 2.5 6.7 2.5 2.5 6.7 2.5 12s4.2 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}

export function SignInButton() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/";
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: { hd: "voice123.com", prompt: "select_account" },
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setPending(false);
      toast.error("Couldn't start sign-in", { description: error.message });
    }
  }

  return (
    <Button
      onClick={handleSignIn}
      disabled={pending}
      size="lg"
      className="h-12 w-full gap-3 text-base"
    >
      <GoogleMark />
      {pending ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
