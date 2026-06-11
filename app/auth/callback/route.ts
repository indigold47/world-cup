import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // The auth trigger raises an exception for non-@voice123.com emails,
    // which surfaces as an error here. Map to a friendly error code.
    const isDomainReject = /voice123\.com/i.test(error.message);
    const errorCode = isDomainReject ? "domain" : "oauth";
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/sign-in?error=${errorCode}`);
  }

  // Defensively refresh display_name from the Google profile so the trigger's
  // initial guess is overridden if Google updates it later. RLS allows a user
  // to update their own profile.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const googleName =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined);
    if (googleName) {
      await supabase
        .from("profiles")
        .update({ display_name: googleName })
        .eq("id", user.id);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
