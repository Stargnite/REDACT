import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type AI,
  type GenerativeModel,
} from "firebase/ai";
import { getFirebaseApp, isFirebaseConfigured, startAppCheck } from "./firebase";
import type { ModelRun, ModelRunner, Tier } from "./model";
import { SCHEMA_HINT, SYSTEM_INSTRUCTION } from "./prompt";

const CLOUD_MODEL =
  process.env.NEXT_PUBLIC_FIREBASE_CLOUD_MODEL ?? "gemini-2.5-flash";

/**
 * The on-device path in the Firebase AI SDK does not read the system
 * instruction off the request. It only maps the request contents, and Chrome
 * gets its system turn from the initial prompts passed when the session is
 * created. So the on-device model and the cloud model are told the same
 * thing in two different places.
 */
const ON_DEVICE_SYSTEM_PROMPT = `${SYSTEM_INSTRUCTION}

${SCHEMA_HINT}`;

const CLOUD_SYSTEM_PROMPT = `${SYSTEM_INSTRUCTION}

${SCHEMA_HINT}`;

let ai: AI | null = null;
let onDeviceModel: GenerativeModel | null = null;
let cloudModel: GenerativeModel | null = null;
let deviceReady = false;

function getAi(): AI {
  if (!ai) {
    startAppCheck();
    ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
  }
  return ai;
}

function getOnDeviceModel(): GenerativeModel {
  if (!onDeviceModel) {
    onDeviceModel = getGenerativeModel(getAi(), {
      mode: InferenceMode.ONLY_ON_DEVICE,
      inCloudParams: { model: CLOUD_MODEL, systemInstruction: CLOUD_SYSTEM_PROMPT },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
          initialPrompts: [
            {
              role: "system",
              content: [{ type: "text", value: ON_DEVICE_SYSTEM_PROMPT }],
            },
          ],
        },
      },
    });
  }
  return onDeviceModel;
}

function getCloudModel(): GenerativeModel {
  if (!cloudModel) {
    cloudModel = getGenerativeModel(getAi(), {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: { model: CLOUD_MODEL, systemInstruction: CLOUD_SYSTEM_PROMPT },
    });
  }
  return cloudModel;
}

/**
 * Chrome will not download the on-device model without a user gesture first,
 * and the Scan button is that gesture. Awaiting this once means the first
 * scan does not race a download that is still in flight.
 */
async function ensureDeviceReady(model: GenerativeModel): Promise<void> {
  if (deviceReady) return;
  deviceReady = true;
  await model.initializeDeviceModel();
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The model tier could not run.";
}

async function runOnDevice(text: string): Promise<ModelRun> {
  const model = getOnDeviceModel();
  await ensureDeviceReady(model);

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text, type: "text" }] }],
  });

  const raw = result.response.text();
  const ranOnDevice = result.response.inferenceSource !== "in_cloud";

  return {
    ok: true,
    raw,
    tier: "on_device",
    source: ranOnDevice ? "on_device" : "in_cloud",
    charsSent: ranOnDevice ? 0 : text.length,
  };
}

async function runInCloud(text: string): Promise<ModelRun> {
  const model = getCloudModel();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text, type: "text" }] }],
  });

  const raw = result.response.text();

  return {
    ok: true,
    raw,
    tier: "cloud",
    source: "in_cloud",
    charsSent: text.length,
  };
}

/**
 * The runner the UI passes into the scan pipeline.
 *
 * It returns null when Firebase is not configured, which is what puts the
 * app into patterns-only mode. The pattern tier needs nothing but the
 * browser, so the product still works without a project.
 */
export function createModelRunner(): ModelRunner | null {
  if (!isFirebaseConfigured()) return null;

  return async (text: string, tier: Tier): Promise<ModelRun> => {
    try {
      return tier === "on_device" ? await runOnDevice(text) : await runInCloud(text);
    } catch (error) {
      return {
        ok: false,
        raw: "",
        tier,
        source: tier === "cloud" ? "in_cloud" : "on_device",
        charsSent: 0,
        error: describeError(error),
      };
    }
  };
}
