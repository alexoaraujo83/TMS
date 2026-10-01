import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export const runtime = "nodejs";

const OWNER = "alexoaraujo83";
const REPO = "TMS";
const WORKFLOW = "restore-verify.yml";
const API = "https://api.github.com";

type Run = {
  id: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  status: "queued" | "in_progress" | "completed";
  conclusion: string | null;
  display_title: string;
};
type Job = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
};
type Step = { name: string; status: string; conclusion: string | null };

async function github(path: string, token: string) {
  const response = await fetch(API + path, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response;
}

function publicStatus(run: Run) {
  if (run.conclusion === "success") return "verified";
  if (run.conclusion === "failure" || run.conclusion === "cancelled" || run.conclusion === "timed_out") return "failed";
  if (run.status === "in_progress") return "running";
  return "queued";
}

export async function GET(request: Request) {
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const allowedSubjects = (process.env.RESTORE_VERIFY_ALLOWED_SUBJECTS ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const subject = session.user?.sub;
  if (!subject || allowedSubjects.length === 0 || !allowedSubjects.includes(subject)) {
    return NextResponse.json({ error: "Restore verification is not authorized for this session." }, { status: 403 });
  }

  const token = process.env.GITHUB_RESTORE_DISPATCH_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "Restore executor is not configured." }, { status: 503 });

  const since = new URL(request.url).searchParams.get("since");
  const sinceMs = since ? Date.parse(since) : NaN;

  try {
    const response = await github(
      `/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs?branch=main&per_page=10`,
      token,
    );
    const runs = (await response.json()).workflow_runs as Run[];
    const run = runs.find((candidate) => {
      const created = Date.parse(candidate.created_at);
      return Number.isNaN(sinceMs) || created >= sinceMs;
    });

    if (!run) return NextResponse.json({ status: "pending", message: "Aguardando o workflow de restore iniciar." });

    const jobsResponse = await github(`/repos/${OWNER}/${REPO}/actions/runs/${run.id}/jobs?per_page=10`, token);
    const jobs = (await jobsResponse.json()).jobs as Job[];
    const job = jobs[0];
    let steps: Step[] = [];
    if (job) {
      const stepsResponse = await github(`/repos/${OWNER}/${REPO}/actions/jobs/${job.id}`, token);
      const payload = await stepsResponse.json();
      steps = (payload.steps ?? []) as Step[];
    }

    return NextResponse.json({
      status: publicStatus(run),
      runId: run.id,
      runUrl: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
      conclusion: run.conclusion,
      displayTitle: run.display_title,
      steps: steps.map((step) => ({
        name: step.name,
        status: step.status,
        conclusion: step.conclusion,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar o status do restore." }, { status: 502 });
  }
}
