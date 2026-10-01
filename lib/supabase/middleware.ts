import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/env";

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

export async function updateSession(request: NextRequest) {
  let env: ReturnType<typeof getPublicSupabaseEnv>;
  try {
    env = getPublicSupabaseEnv();
  } catch {
    return new NextResponse(
      "Harbor is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to this deployment's environment variables, then redeploy.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }
  const { url, key } = env;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ?? null;

  const path = request.nextUrl.pathname;
  const isGuestOnly = path === "/login" || path === "/signup";
  const isPublic = path.startsWith("/auth/") || isGuestOnly;

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    if (path !== "/login") {
      redirectUrl.searchParams.set("next", path);
    }
    return copyCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (user && (isGuestOnly || path === "/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return copyCookies(response, NextResponse.redirect(redirectUrl));
  }

  return response;
}
