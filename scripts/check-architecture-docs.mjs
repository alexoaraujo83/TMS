import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const architectureDir = join(root, "docs", "architecture");
const required = ["context.mmd", "deployment.mmd", "domain.mmd"];
const expectedMarkers = {
  "context.mmd": ["TMS Web", "TMS API", "Auth0", "PostgreSQL / Neon", "TMS Worker"],
  "deployment.mmd": ["GitHub", "Vercel", "Railway", "Auth0", "Neon PostgreSQL", "Versioned release manifest"],
  "domain.mmd": ["IAM / Tenancy", "Master Data", "Freight", "Matching", "Trip Operations", "Compliance / GR", "Finance", "Reliability", "Audit / Observability"],
};

for (const file of required) {
  const path = join(architectureDir, file);
  try {
    const content = readFileSync(path, "utf8");
    if (content.trim().length === 0) throw new Error("empty file");
    if (!content.includes("%% TMS —")) throw new Error("missing TMS Mermaid header");
    for (const marker of expectedMarkers[file]) {
      if (!content.includes(marker)) throw new Error(`missing expected architecture marker: ${marker}`);
    }
  } catch (error) {
    console.error(`Architecture documentation check failed for ${file}: ${error.message}`);
    process.exit(1);
  }
}

const indexPath = join(architectureDir, "README.md");
const index = readFileSync(indexPath, "utf8");
for (const file of required) {
  if (!index.includes(`./${file}`)) {
    console.error(`Architecture documentation index does not reference ${file}`);
    process.exit(1);
  }
}

if (statSync(architectureDir).isDirectory() !== true) {
  console.error("Architecture documentation directory is invalid");
  process.exit(1);
}

console.log("Architecture documentation check passed: context, deployment and domain diagrams are present and indexed.");