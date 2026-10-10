import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminConfiguration, adminCookieOptions } from "@/lib/admin/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = adminConfiguration();
  if (config) {
    const client = createServerClient(config.url, config.key, {
      cookieOptions: adminCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    await client.auth.getClaims();
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Referrer-Policy", "same-origin");
  return response;
}
export const config = { matcher: ["/admin/:path*"] };
