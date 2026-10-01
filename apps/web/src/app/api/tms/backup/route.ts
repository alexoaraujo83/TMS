import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export const runtime = "nodejs";

const WORKFLOW = "backup-now.yml";
const OWNER = "alexoaraujo83";
const REPO = "TMS";
const BRANCH = "main";

export async function POST(request: Request) {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  const origin = request.headers.get("origin");
  if (origin && appBaseUrl && origin !== appBaseUrl) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });

  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const allowedSubjects = (process.env.BACKUP_ALLOWED_SUBJECTS ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const subject = session.user?.sub;
  if (!subject || allowedSubjects.length === 0 || !allowedSubjects.includes(subject)) {
    return NextResponse.json({ error: "Backup is not authorized for this session." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { confirmation?: string };
  if (body.confirmation !== "BACKUP-NOW") return NextResponse.json({ error: "Confirmation required" }, { status: 400 });

  const token = process.env.GITHUB_BACKUP_DISPATCH_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "Backup executor is not configured: GITHUB_BACKUP_DISPATCH_TOKEN is missing." }, { status: 503 });

  const response = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ ref: BRANCH }),
      cache: "no-store",
    },
  );

  if (!response.ok) return NextResponse.json({ error: "GitHub did not accept the backup workflow dispatch.", status: response.status }, { status: 502 });

  return NextResponse.json({
    ok: true,
    status: "dispatched",
    message: "Backup solicitado. Acompanhe o workflow run para o resultado.",
    runUrl: `https://github.com/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}`,
  });
}
