import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export const runtime = "nodejs";

const API_PATH = "/backups/manifests";

export async function GET(request: Request) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const allowedSubjects = (process.env.RESTORE_VERIFY_ALLOWED_SUBJECTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const subject = session.user?.sub;
  if (!subject || allowedSubjects.length === 0 || !allowedSubjects.includes(subject)) {
    return NextResponse.json({ error: "Backup catalog is not authorized for this session." }, { status: 403 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "API base URL is not configured." }, { status: 503 });
  }

  try {
    const fetcher = await auth0.createFetcher(request, { baseUrl: apiBaseUrl });
    const response = await fetcher.fetchWithAuth(API_PATH, { cache: "no-store" });
    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      return NextResponse.json(
        { error: body?.message ?? body?.error ?? "Não foi possível carregar o catálogo estruturado de backups." },
        { status: response.status },
      );
    }

    return NextResponse.json(body, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar o catálogo estruturado de backups." },
      { status: 502 },
    );
  }
}
