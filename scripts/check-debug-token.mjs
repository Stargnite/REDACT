import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n")
  .filter((line) => line.includes("="))
  .map((line) => {
    const at = line.indexOf("=");
    return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
  });

const get = (name) => env.find(([key]) => key === name)?.[1];

const projectId = get("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const appId = get("NEXT_PUBLIC_FIREBASE_APP_ID");
const apiKey = get("NEXT_PUBLIC_FIREBASE_API_KEY");
const debugToken = get("NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN");

console.log("debug token in .env.local:", debugToken);

const res = await fetch(
  "https://content-firebaseappcheck.googleapis.com/v1/projects/" +
    projectId +
    "/apps/" +
    appId +
    ":exchangeDebugToken?key=" +
    apiKey,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ debug_token: debugToken }),
  }
);

const body = await res.json();

if (!body.token) {
  console.log("EXCHANGE FAILED", res.status, JSON.stringify(body));
  process.exit(1);
}

console.log("EXCHANGE OK", res.status, "token length", body.token.length);

// Now use it against the model endpoint, which is where App Check is enforced.
const modelRes = await fetch(
  "https://firebasevertexai.googleapis.com/v1beta/projects/" +
    projectId +
    "/models/gemini-3.8-flash:generateContent?key=" +
    apiKey,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-firebase-appcheck": body.token,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Reply with only this JSON: {\"findings\": []}" }] }],
    }),
    signal: AbortSignal.timeout(120000),
  }
);

console.log("MODEL CALL", modelRes.status, (await modelRes.text()).slice(0, 400));
