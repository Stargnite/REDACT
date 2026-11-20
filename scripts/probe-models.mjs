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

async function appCheckToken() {
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
  return (await res.json()).token;
}

const token = await appCheckToken();

const body = JSON.stringify({
  contents: [
    {
      role: "user",
      parts: [{ text: "Reply with only this JSON: {\"findings\": []}" }],
    },
  ],
});

async function call(model) {
  try {
    const res = await fetch(
      "https://firebasevertexai.googleapis.com/v1beta/projects/" +
        projectId +
        "/models/" +
        model +
        ":generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-firebase-appcheck": token,
        },
        body,
        signal: AbortSignal.timeout(120000),
      }
    );
    const text = await res.text();
    return res.status + " " + text.slice(0, 300);
  } catch (error) {
    return error.name + " " + error.message;
  }
}

const model = process.argv[2] ?? "gemini-3.8-flash";
const attempts = Number(process.argv[3] ?? 4);

for (let i = 1; i <= attempts; i++) {
  const started = Date.now();
  const result = await call(model);
  console.log(model + " attempt " + i + " (" + ((Date.now() - started) / 1000).toFixed(1) + "s): " + result);
  if (result.startsWith("200")) break;
}
