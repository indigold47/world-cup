"use client";

import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, { title: string; description: string }> = {
  domain: {
    title: "Only @voice123.com accounts can play",
    description:
      "Sign in with your work Google account. Personal Gmail addresses can't join the pool.",
  },
  oauth: {
    title: "Sign-in didn't complete",
    description: "Something went wrong with Google. Please try again.",
  },
};

export function SignInError() {
  const params = useSearchParams();
  const code = params.get("error");
  const message = code ? MESSAGES[code] ?? MESSAGES.oauth : null;
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
    >
      <p className="font-medium text-destructive">{message.title}</p>
      <p className="mt-1 text-destructive/80">{message.description}</p>
    </div>
  );
}
