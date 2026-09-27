import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const [exportedFile, contractFile, sourceActionFile] = process.argv.slice(2);

if (!exportedFile || !contractFile || !sourceActionFile) {
  console.error("Usage: compare-production-export.mjs <exported tenant.yaml> <contract tenant.yaml> <source action.js>");
  process.exit(2);
}

const require = createRequire(
  path.join(
    process.env.AUTH0_DEPLOY_NODE_MODULES || "",
    "compare-production-export.mjs"
  )
);
const yaml = require("js-yaml");

const exported = yaml.load(fs.readFileSync(exportedFile, "utf8")) || {};
const contract = yaml.load(fs.readFileSync(contractFile, "utf8")) || {};

const expectedName = "TMS — Tenant Claim";
const exportedActions = Array.isArray(exported.actions) ? exported.actions : [];
const contractActions = Array.isArray(contract.actions) ? contract.actions : [];

const exportedAction = exportedActions.find((action) => action?.name === expectedName);
const contractAction = contractActions.find((action) => action?.name === expectedName);

if (!exportedAction) throw new Error(`Production export does not contain expected Action: ${expectedName}`);
if (!contractAction) throw new Error(`Source contract does not contain expected Action: ${expectedName}`);

const normalizeCode = (value) => String(value ?? "").replace(/\r\n/g, "\n").trim();
const exportedCodePath = exportedAction.code;

if (typeof exportedCodePath !== "string" || exportedCodePath.length === 0) {
  throw new Error("Production export did not expose an Action code path");
}

const resolvedExportedCode = path.resolve(path.dirname(exportedFile), exportedCodePath);
if (!fs.existsSync(resolvedExportedCode)) {
  throw new Error(`Exported Action code file not found: ${resolvedExportedCode}`);
}

const liveCode = normalizeCode(fs.readFileSync(resolvedExportedCode, "utf8"));
const sourceCode = normalizeCode(fs.readFileSync(sourceActionFile, "utf8"));

if (liveCode !== sourceCode) {
  console.error("AUTH0_DRIFT: Production Post-Login Action code differs from the source contract.");
  process.exit(10);
}

const requiredTrigger = { id: "post-login", version: "v3" };
const liveTriggers = Array.isArray(exportedAction.supported_triggers) ? exportedAction.supported_triggers : [];

if (!liveTriggers.some((trigger) =>
  trigger?.id === requiredTrigger.id && trigger?.version === requiredTrigger.version
)) {
  throw new Error("AUTH0_DRIFT: Production Action does not expose the expected post-login v3 trigger.");
}

if (exportedAction.deployed !== true) {
  throw new Error("AUTH0_DRIFT: Production Action is not marked deployed.");
}

const liveBindings = exported?.triggers?.["post-login"];
if (!Array.isArray(liveBindings)) {
  throw new Error("AUTH0_DRIFT: Production export does not contain post-login bindings.");
}

const matchingBindings = liveBindings.filter(
  (binding) => binding?.action_name === expectedName
);

if (matchingBindings.length !== 1) {
  throw new Error(
    `AUTH0_DRIFT: Expected exactly one post-login binding for "${expectedName}", found ${matchingBindings.length}.`
  );
}

for (const pattern of [/api\.access\.deny/, /missing_tenant_id/]) {
  if (pattern.test(liveCode)) {
    throw new Error(`AUTH0_DRIFT: Production Action contains forbidden regression pattern: ${pattern}`);
  }
}

console.log(JSON.stringify({
  status: "match",
  action: expectedName,
  deployed: exportedAction.deployed,
  trigger: requiredTrigger,
  post_login_binding_count: matchingBindings.length,
  forbidden_patterns_checked: 2,
}, null, 2));
