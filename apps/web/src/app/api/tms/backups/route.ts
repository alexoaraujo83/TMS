import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export const runtime = "nodejs";

const OWNER = "alexoaraujo83";
const REPO = "TMS";
const WORKFLOW = "backup-now.yml";
const API = "https://api.github.com";
const AUTH_HEADER = "application/vnd.github+json";
const OBJECT_PATTERN = /object=(tms\/postgres\/\d{8}T\d{6}Z\/tms-\d{8}T\d{6}Z\.dump\.enc)/;
const FIELD_PATTERNS = {
  bytes: /bytes=(\d+)/,
  sha256: /sha256=([a-f0-9]{64})/,
  postgresVersion: /postgres_version=([^\n\r]+)/,
  migrationTable: /migration_table=([^\n\r]+)/,
  migrationCount: /migration_count=([^\n\r]+)/,
  durationSeconds: /duration_seconds=(\d+)/,
};

type Run = { id: number; html_url: string; created_at: string; conclusion: string | null };
type Job = { id: number; name: string; conclusion: string | null };

async function github(path: string, token: string) {
  const response = await fetch(API + path, {
    headers: {
      accept: AUTH_HEADER,
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response;
}

function matchField<T extends string | number>(logs: string, pattern: RegExp, transform: (value: string) => T): T | null {
  const match = logs.match(pattern);
  return match ? transform(match[1].trim()) : null;
}

export async function GET() {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const allowedSubjects = (process.env.RESTORE_VERIFY_ALLOWED_SUBJECTS ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const subject = session.user?.sub;
  if (!subject || allowedSubjects.length === 0 || !allowedSubjects.includes(subject)) {
    return NextResponse.json({ error: "Backup catalog is not authorized for this session." }, { status: 403 });
  }

  const token = process.env.GITHUB_RESTORE_DISPATCH_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "Restore executor is not configured." }, { status: 503 });

  try {
    const runsResponse = await github(
      `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs?branch=main&status=success&per_page=20`,
      token,
    );
    const runs = (await runsResponse.json()).workflow_runs as Run[];
    const backups: Array<Record<string, unknown>> = [];

    for (const run of runs) {
      const jobsResponse = await github(
        `/repos/${OWNER}/${REPO}/actions/runs/${run.id}/jobs?per_page=10`,
        token,
      );
      const jobs = (await jobsResponse.json()).jobs as Job[];
      const job = jobs.find((item) => item.name === "Production backup") ?? jobs[0];
      if (!job || job.conclusion !== "success") continue;

      const logsResponse = await github(
        `/repos/${OWNER}/${REPO}/actions/jobs/${job.id}/logs`,
        token,
      );
      const logs = await logsResponse.text();
      const objectMatch = logs.match(OBJECT_PATTERN);
      if (!objectMatch) continue;

      backups.push({
        object: objectMatch[1],
        runId: run.id,
        runUrl: run.html_url,
        createdAt: run.created_at,
        bytes: matchField(logs, FIELD_PATTERNS.bytes, Number),
        sha256: matchField(logs, FIELD_PATTERNS.sha256, String),
        postgresVersion: matchField(logs, FIELD_PATTERNS.postgresVersion, String),
        migrationTable: matchField(logs, FIELD_PATTERNS.migrationTable, String),
        migrationCount: matchField(logs, FIELD_PATTERNS.migrationCount, String),
        durationSeconds: matchField(logs, FIELD_PATTERNS.durationSeconds, Number),
        integrity: "verified",
        origin: "Backup Now",
      });
    }

    const unique = Array.from(new Map(backups.map((item) => [item.object, item])).values());
    unique.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return NextResponse.json({
      backups: unique.slice(0, 20),
      generatedAt: new Date().toISOString(),
      source: "successful Backup Now workflow runs",
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar o catálogo de backups." }, { status: 502 });
  }
}
