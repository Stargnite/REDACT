import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

/**
 * A build-time guard. `NEXT_PUBLIC_*` values are inlined into the client
 * bundle, so a value that should never ship can be shipped by accident - the
 * App Check debug token being the one that matters here, because anyone
 * holding it can mint App Check tokens and spend the project's quota.
 */

const SECRETISH = /SECRET|DEBUG_TOKEN|PRIVATE_KEY|PASSWORD/;
const root = fileURLToPath(new URL("..", import.meta.url));

let env = "";
try {
  env = readFileSync(join(root, ".env.local"), "utf8");
} catch {
  console.log("no .env.local - nothing to check");
  process.exit(0);
}

const secrets = env
  .split("\n")
  .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
  .map((line) => {
    const at = line.indexOf("=");
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  })
  .filter(([name, value]) => SECRETISH.test(name) && value.length > 8)
  .map(([name, value]) => ({ name, value }));

if (secrets.length === 0) {
  console.log("no secret-shaped values in .env.local");
  process.exit(0);
}

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

let outDir;
try {
  outDir = join(root, "out");
  statSync(outDir);
} catch {
  console.log("no out/ directory - nothing to check");
  process.exit(0);
}

let leaked = false;
for (const file of walk(outDir)) {
  if (!/\.(js|css|html|json|txt|map)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  for (const { name, value } of secrets) {
    if (text.includes(value)) {
      console.error(`LEAK: ${name} appears in ${relative(root, file)}`);
      leaked = true;
    }
  }
}

if (leaked) {
  console.error("A secret reached the built bundle. Do not deploy this.");
  process.exit(1);
}

console.log(`bundle clean - ${secrets.map((s) => s.name).join(", ")} absent from out/`);
