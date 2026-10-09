#!/usr/bin/env node
/**
 * CARE-Map first-install setup.
 * Run: node --env-file=.env.local scripts/setup.mjs
 * Never commit .env.local or print secrets.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const required = ["DATABASE_URL", "AIVEN_CA_CERT", "ADMIN_EMAIL", "ADMIN_PASSWORD"];
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error("Missing required environment variables: " + missing.join(", "));
  console.error("Set them in a private .env.local and run: node --env-file=.env.local scripts/setup.mjs");
  process.exit(1);
}

if (process.env.ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must contain at least 12 characters.");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ADMIN_EMAIL)) {
  console.error("ADMIN_EMAIL must be a valid email address.");
  process.exit(1);
}
const cert = process.env.AIVEN_CA_CERT.replace(/\\n/g, "\n").trim();
if (!cert.startsWith("-----BEGIN CERTIFICATE-----") || !cert.endsWith("-----END CERTIFICATE-----")) {
  console.error("AIVEN_CA_CERT must contain a valid PEM certificate envelope.");
  process.exit(1);
}
let database;
try {
  database = new URL(process.env.DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.hostname) {
    throw new Error("Unsupported database URL");
  }
} catch {
  console.error("DATABASE_URL must be a valid PostgreSQL connection URI.");
  process.exit(1);
}

function execute(script, label) {
  console.log("\n" + label);
  const result = spawnSync(process.execPath, [path.join(root, "scripts", script)], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error("Unable to start " + label + ": " + result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(label + " failed. Setup stopped without continuing.");
    process.exit(result.status || 1);
  }
}

console.log("CARE-Map: initializing PostgreSQL/PostGIS and administrator account");
console.log("Database host: " + database.hostname);
console.log("Credentials will not be displayed.");
execute("migrate.mjs", "Step 1/2: Applying database migrations");
execute("seed-admin.mjs", "Step 2/2: Creating/updating the administrator");
console.log("\nCARE-Map setup finished successfully.");
console.log("Next: redeploy Vercel with SESSION_SECRET and CRON_SECRET, then check Production Readiness.");
