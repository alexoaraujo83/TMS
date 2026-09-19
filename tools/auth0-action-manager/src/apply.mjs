import { ManagementClient } from "auth0";

const domain = process.env.AUTH0_DOMAIN ?? "tms-platform.us.auth0.com";
const token = process.env.AUTH0_MGMT_TOKEN;
const actionName = process.env.AUTH0_ACTION_NAME ?? "TMS - Tenant Claim";
const triggerVersion = process.env.AUTH0_POST_LOGIN_TRIGGER_VERSION ?? "v3";
const namespace = "https://tms-platform.io/claims";
const tenantClaim = namespace + "/tenant_id";

if (!token) throw new Error("AUTH0_MGMT_TOKEN is required.");

const management = new ManagementClient({ domain, token });
const code = [
  "exports.onExecutePostLogin = async (event, api) => {",
  "  const namespace = \"https://tms-platform.io/claims\";",
  "  const tenantId = event.user.app_metadata?.tenant_id;",
  "",
  "  if (!tenantId) return;",
  "",
  "  api.accessToken.setCustomClaim(namespace + \"/tenant_id\", tenantId);",
  "  api.idToken.setCustomClaim(namespace + \"/tenant_id\", tenantId);",
  "};"
].join("\n");

const apiBase = "https://" + domain + "/api/v2";

async function managementFetch(path, options = {}) {
  const response = await fetch(apiBase + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error("Auth0 Management API " + response.status + ": " + JSON.stringify(body));
  return body;
}

async function findAction() {
  const response = await management.actions.list({
    triggerId: "post-login", actionName, per_page: 100, page: 0,
  });
  return (response.data ?? []).find((action) => action.name === actionName);
}

async function ensureAction() {
  let action = await findAction();
  const payload = {
    name: actionName,
    supported_triggers: [{ id: "post-login", version: triggerVersion }],
    code,
    dependencies: [],
  };
  if (!action) {
    const response = await management.actions.create(payload);
    action = response.data;
    console.log("Created Action: " + action.id);
  } else {
    const response = await management.actions.update(action.id, payload);
    action = response.data;
    console.log("Updated Action: " + action.id);
  }
  return action;
}

async function deployAction(actionId) {
  const response = await management.actions.deploy(actionId);
  return response.data;
}

async function getBindings() {
  return managementFetch("/actions/triggers/post-login/bindings");
}

function normalizeBindings(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.bindings)) return payload.bindings;
  return [];
}

async function ensureBinding(actionId) {
  const current = await getBindings();
  const bindings = normalizeBindings(current);
  const exists = bindings.some((b) => b?.ref?.type === "action_id" && b?.ref?.value === actionId);
  if (exists) return;
  const next = [...bindings, { ref: { type: "action_id", value: actionId }, display_name: actionName }];
  await managementFetch("/actions/triggers/post-login/bindings", {
    method: "PATCH", body: JSON.stringify({ bindings: next }),
  });
}

async function main() {
  console.log("TMS Auth0 Action deployment");
  console.log("Domain: " + domain);
  console.log("Action: " + actionName);
  console.log("Trigger: post-login/" + triggerVersion);
  console.log("Claim: " + tenantClaim);

  const action = await ensureAction();
  await deployAction(action.id);
  await ensureBinding(action.id);
  const finalBindings = normalizeBindings(await getBindings());
  const bound = finalBindings.some((b) => b?.ref?.type === "action_id" && b?.ref?.value === action.id);
  if (!bound) throw new Error("Action deployed but Post Login binding was not verified.");

  console.log(JSON.stringify({
    status: "verified", action_id: action.id, action_name: actionName,
    trigger: "post-login", trigger_version: triggerVersion, deployed: true,
    bound: true, tenant_claim: tenantClaim,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});