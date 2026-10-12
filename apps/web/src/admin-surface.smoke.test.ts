import assert from "node:assert/strict";
import test from "node:test";

const configuredBaseUrl = process.env.TMS_WEB_BASE_URL?.trim();
const baseUrl = configuredBaseUrl ? new URL(configuredBaseUrl) : null;

if (baseUrl && !["http:", "https:"].includes(baseUrl.protocol)) {
  throw new Error("TMS_WEB_BASE_URL must use http or https");
}

async function request(path: string) {
  assert.ok(baseUrl, "TMS_WEB_BASE_URL is required for live smoke tests");
  return fetch(new URL(path, baseUrl), {
    redirect: "manual",
    headers: { accept: "text/html,application/json" },
    signal: AbortSignal.timeout(15_000),
  });
}

test("web surface smoke tests", { skip: !baseUrl && "Set TMS_WEB_BASE_URL to run deployed-surface checks" }, async (t) => {
  await t.test("landing page is reachable", async () => {
    const response = await request("/");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
    const html = await response.text();
    assert.match(html, /TMS/i);
    assert.doesNotMatch(html, /(?:npg_[A-Za-z0-9]+|sk-[A-Za-z0-9_-]{12,}|re_[A-Za-z0-9_-]{12,})/);
  });

  await t.test("admin surface redirects unauthenticated users to login", async () => {
    const response = await request("/admin");
    assert.ok([301, 302, 303, 307, 308].includes(response.status), `Expected redirect, received ${response.status}`);
    const location = response.headers.get("location") ?? "";
    assert.match(location, /\/auth\/login/);
    assert.doesNotMatch(location, /(?:javascript:|data:)/i);
  });

  await t.test("project-control data is not anonymously readable", async () => {
    const response = await request("/api/tms/project-control");
    assert.ok(
      [401, 403, 302, 303, 307, 308].includes(response.status),
      `Expected an authentication/authorization response, received ${response.status}`,
    );
    const body = await response.text();
    assert.doesNotMatch(body, /(?:postgres(?:ql)?:\/\/|npg_[A-Za-z0-9]+|AUTH0_CLIENT_SECRET|BACKUP_ENCRYPTION_KEY)/i);
  });

  await t.test("operational health data is not anonymously readable", async () => {
    const response = await request("/api/tms/admin/health");
    assert.ok(
      [401, 403, 302, 303, 307, 308].includes(response.status),
      `Expected an authentication/authorization response, received ${response.status}`,
    );
    const body = await response.text();
    assert.doesNotMatch(body, /(?:postgres(?:ql)?:\/\/|npg_[A-Za-z0-9]+|AUTH0_CLIENT_SECRET|BACKUP_ENCRYPTION_KEY)/i);
  });

  await t.test("profile and access-token endpoints do not expose anonymous credentials", async () => {
    for (const path of ["/auth/profile", "/auth/access-token"]) {
      const response = await request(path);
      assert.ok(
        !response.ok,
        `${path} unexpectedly returned HTTP ${response.status} without a session`,
      );
      const body = await response.text();
      assert.doesNotMatch(body, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/);
    }
  });
});
