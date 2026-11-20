import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const store = JSON.parse(
  readFileSync(homedir() + "/.config/configstore/firebase-tools.json", "utf8")
);

const token = store.tokens.access_token;
const projectNumber = "95167246245";

const services = [
  "firebasevertexai.googleapis.com",
  "firebaseappcheck.googleapis.com",
];

for (const service of services) {
  const res = await fetch(
    "https://serviceusage.googleapis.com/v1/projects/" +
      projectNumber +
      "/services/" +
      service +
      ":enable",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
    }
  );
  const body = await res.text();
  console.log(service, res.status, body.slice(0, 600));
}
