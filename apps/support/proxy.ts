import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  readSupportAuthConfig,
  SUPPORT_AUTH_COOKIE_NAME,
} from "./lib/auth-config";

/** Refresh only this portal's host-only cookie; pages/actions verify Auth and API RBAC. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  // Keep the public login renderable even before deployment secrets are installed.
  let settings;
  try {
    settings = readSupportAuthConfig();
  } catch {
    return response;
  }
  const own = (name: string) =>
    /^gridex-support-auth(?:\.\d+|-code-verifier(?:\.\d+)?)?$/.test(name);
  const auth = createServerClient(settings.url, settings.anonKey, {
    cookieOptions: {
      name: SUPPORT_AUTH_COOKIE_NAME,
      path: "/",
      httpOnly: true,
      secure: settings.cookieSecure,
      sameSite: "lax",
    },
    cookies: {
      getAll: () => request.cookies.getAll().filter((c) => own(c.name)),
      setAll: (updates) => {
        if (updates.some((c) => !own(c.name)))
          throw new Error("Invalid support cookie");
        updates.forEach((c) => request.cookies.set(c.name, c.value));
        response = NextResponse.next({ request });
        response.headers.set("Cache-Control", "private, no-store");
        updates.forEach(({ name, value, options }) => {
          const hostOptions = { ...options };
          delete hostOptions.domain;
          response.cookies.set(name, value, {
            ...hostOptions,
            path: "/",
            httpOnly: true,
            secure: settings.cookieSecure,
            sameSite: "lax",
          });
        });
      },
    },
  });
  try {
    await auth.auth.getUser();
  } catch {
    /* Protected pages fail closed through requireSupportSession. */
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
