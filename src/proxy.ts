import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const protectedPath = /^\/(dashboard|discover|applications|settings|onboarding|admin)(\/|$)/;

export async function proxy(request: NextRequest) {
  const isProtected = protectedPath.test(request.nextUrl.pathname);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    if (isProtected) {
      const destination = new URL("/sign-in?error=configuration", request.url);
      return NextResponse.redirect(destination);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        for (const [name, value] of Object.entries(cacheHeaders)) {
          response.headers.set(name, value);
        }
      },
    },
  });

  const { data: claimData } = await supabase.auth.getClaims();

  if (isProtected && !claimData?.claims) {
    const destination = new URL("/sign-in", request.url);
    destination.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    const redirectResponse = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(name);
      if (value) redirectResponse.headers.set(name, value);
    }
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};