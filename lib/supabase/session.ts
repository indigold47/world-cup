import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";

const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];

// Prefixes Next.js serves as build artifacts / public assets. The proxy
// matcher should skip these, but Next 16's proxyConfig matcher doesn't
// always honor the negative-lookahead pattern reliably, so we guard here
// too. If we redirect these to /sign-in, the whole app loads unstyled
// because the CSS bundle never actually arrives.
const STATIC_PREFIXES = [
  "/_next/",
  "/favicon",
  "/api/",
];

const STATIC_EXTENSIONS =
  /\.(css|js|map|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$/i;

function isStaticAsset(pathname: string): boolean {
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (STATIC_EXTENSIONS.test(pathname)) return true;
  return false;
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Fast path: never auth-gate static assets or framework chunks.
  if (isStaticAsset(pathname)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
