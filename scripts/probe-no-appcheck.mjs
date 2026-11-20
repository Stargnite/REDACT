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
const apiKey = get("NEXT_PUBLIC_FIREBASE_API_KEY");
const model = get("NEXT_PUBLIC_FIREBASE_CLOUD_MODEL");

// No App Check header at all. If enforcement is on for AI Logic this is
// rejected with 403 before the request ever reaches the model.
const res = await fetch(
  "https://firebasevertexai.googleapis.com/v1beta/projects/" +
    projectId +
    "/models/" +
    model +
    ":generateContent?key=" +
    apiKey,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
    }),
    signal: AbortSignal.timeout(60000),
  }
);

console.log("no app check token ->", res.status);
console.log((await res.text()).slice(0, 500));
