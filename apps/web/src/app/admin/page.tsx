import { redirect, notFound } from "next/navigation";
import { auth0 } from "../../lib/auth0";
import ProjectControlDashboard from "./project-control-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth0.getSession();
  if (!session) redirect("/auth/login?returnTo=/admin");

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) notFound();

  // A valid browser session is not sufficient for administrative access.
  // Reuse the canonical API PermissionGuard via ops:diagnostics; fail closed
  // if the permission cannot be confirmed.
  let authorizationStatus = 503;
  try {
    const fetcher = await auth0.createFetcher(undefined, { baseUrl: apiBaseUrl });
    const authorization = await fetcher.fetchWithAuth("/freights/runtime-context", {
      method: "GET",
      cache: "no-store",
    });
    authorizationStatus = authorization.status;
    await authorization.body?.cancel();
  } catch {
    authorizationStatus = 503;
  }

  if (authorizationStatus === 401) redirect("/auth/login?returnTo=/admin");
  if (authorizationStatus !== 200) notFound();

  return <ProjectControlDashboard user={session.user} />;
}
