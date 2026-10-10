import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

export async function proxy(request: NextRequest) {
  // Let this BFF return JSON 401/403 responses instead of having global
  // Auth0 middleware turn fetch calls into HTML redirects. The route handler
  // checks the session and the protected API validates ops:diagnostics.
  if (request.nextUrl.pathname === "/api/tms/admin/diagnostics") {
    return NextResponse.next();
  }
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
