import { redirect } from "next/navigation";
import { auth0 } from "../../lib/auth0";
import ProjectControlDashboard from "./project-control-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth0.getSession();
  if (!session) redirect("/auth/login?returnTo=/admin");

  return <ProjectControlDashboard user={session.user} />;
}
