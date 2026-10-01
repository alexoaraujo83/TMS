import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export const runtime = "nodejs";

const WORKFLOW = "restore-verify.yml";
const OWNER = "alexoaraujo83";
const REPO = "TMS";
const BRANCH = "main";

export async function POST(request: Request) {
  const appBaseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, "");
  const origin = request.headers.get("origin");
  if (origin && appBaseUrl && origin !== appBaseUrl) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const allowedSubjects = (process.env.RESTORE_VERIFY_ALLOWED_SUBJECTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const subject = session.user?.sub;
  if (!subject || allowedSubjects.length === 0 || !allowedSubjects.includes(subject)) {
    return NextResponse.json({ error: "Restore verification is not authorized for this session." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { confirmation?: string; backupObject?: string };
  if (body.confirmation !== "RESTORE-VERIFY") {
    return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  }

  const backupObject = body.backupObject?.trim() ?? "";
  if (!/^tms\/postgres\/\d{8}T\d{6}Z\/tms-\d{8}T\d{6}Z\.dump\.enc$/.test(backupObject)) {
    return NextResponse.json({ error: "Selecione um backup válido do catálogo de backups verificados." }, { status: 400 });
  }

  const token = process.env.GITHUB_RESTORE_DISPATCH_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "Restore executor is not configured: GITHUB_RESTORE_DISPATCH_TOKEN is missing." },
      { status: 503 },
    );
  }

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
      body: JSON.stringify({ ref: BRANCH, inputs: { backup_object: backupObject } }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "GitHub did not accept the restore workflow dispatch.", status: response.status },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    status: "dispatched",
    message: "Restore verification solicitado. Acompanhe o workflow run para o resultado.",
    runUrl: `https://github.com/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}`,
  });
}
