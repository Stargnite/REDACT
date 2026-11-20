import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type AI,
  type Content,
  type GenerativeModel,
} from "firebase/ai";
import { getFirebaseApp, isFirebaseConfigured, startAppCheck } from "./firebase";
import { imagePrompt, imageUserMessage } from "./image-prompt";
import { leakPrompt, leakUserMessage } from "./leak-prompt";
import type {
  ImageInput,
  ImageRun,
  ImageRunner,
  LeakRunner,
  ModelRun,
  ModelRunner,
  Tier,
} from "./model";
import { schemaHint, systemInstruction } from "./prompt";
import type { ScanContext } from "./types";


const CLOUD_MODEL =
  process.env.NEXT_PUBLIC_FIREBASE_CLOUD_MODEL ?? "gemini-3.8-flash";

/**
 * The on-device path in the Firebase AI SDK does not read the system
 * instruction off the request. It only maps the request contents, and Chrome
 * gets its system turn from the initial prompts passed when the session is
 * created. So the on-device model and the cloud model are told the same
 * thing in two different places.
 */
function buildPrompt(context: ScanContext): string {
  return `${systemInstruction(context)}` + "\n\n" + schemaHint(context);
}

let ai: AI | null = null;
const onDeviceModels = new Map<string, GenerativeModel>();
const cloudModels = new Map<string, GenerativeModel>();
const readyModels = new WeakSet<GenerativeModel>();

/**
 * The prompt is fixed when the on-device session is created, so a session
 * belongs to one purpose and one output form. Keying the sessions by context
 * means changing the purpose starts a new session instead of quietly sending
 * the instruction from the last one.
 */
function contextKey(context: ScanContext): string {
  return [context.purpose, context.outputForm, context.purposeNote ?? ""].join("|");
}

function getAi(): AI {
  if (!ai) {
    startAppCheck();
    ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
  }
  return ai;
}

function getOnDeviceModel(context: ScanContext): GenerativeModel {
  const cached = onDeviceModels.get(contextKey(context));
  if (cached) return cached;

  const prompt = buildPrompt(context);
  const model = getGenerativeModel(getAi(), {
    mode: InferenceMode.ONLY_ON_DEVICE,
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: prompt },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
          initialPrompts: [
            {
              role: "system",
              content: [{ type: "text", value: prompt }],
            },
          ],
        },
      },
  });

  onDeviceModels.set(contextKey(context), model);
  return model;
}

function getCloudModel(context: ScanContext): GenerativeModel {
  const cached = cloudModels.get(contextKey(context));
  if (cached) return cached;

  const model = getGenerativeModel(getAi(), {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model: CLOUD_MODEL,
      systemInstruction: buildPrompt(context),
    },
  });

  cloudModels.set(contextKey(context), model);
  return model;
}

/**
 * Chrome will not download the on-device model without a user gesture first,
 * and the Scan button is that gesture. Awaiting this once means the first
 * scan does not race a download that is still in flight.
 */
async function ensureDeviceReady(model: GenerativeModel): Promise<void> {
  if (readyModels.has(model)) return;
  readyModels.add(model);
  await model.initializeDeviceModel();
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "The model tier could not run.";
}

async function runOnDevice(
  text: string,
  context: ScanContext
): Promise<ModelRun> {
  const model = getOnDeviceModel(context);
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

async function runInCloud(
  text: string,
  context: ScanContext
): Promise<ModelRun> {
  const model = getCloudModel(context);

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

  return async (
    text: string,
    tier: Tier,
    context: ScanContext
  ): Promise<ModelRun> => {
    try {
      return tier === "on_device"
        ? await runOnDevice(text, context)
        : await runInCloud(text, context);
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

let leakOnDeviceModel: GenerativeModel | null = null;
let leakCloudModel: GenerativeModel | null = null;

/**
 * The probe has its own model because it has its own instruction, and the
 * on-device session fixes that instruction for good.
 *
 * The probe's instruction never changes, so there is one session for it and
 * no need to key anything by context.
 */
function getLeakOnDeviceModel(): GenerativeModel {
  if (leakOnDeviceModel) return leakOnDeviceModel;

  const prompt = leakPrompt();
  leakOnDeviceModel = getGenerativeModel(getAi(), {
    mode: InferenceMode.ONLY_ON_DEVICE,
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: prompt },
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [
          {
            role: "system",
            content: [{ type: "text", value: prompt }],
          },
        ],
      },
    },
  });

  return leakOnDeviceModel;
}

function getLeakCloudModel(): GenerativeModel {
  if (leakCloudModel) return leakCloudModel;

  leakCloudModel = getGenerativeModel(getAi(), {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: leakPrompt() },
  });

  return leakCloudModel;
}

/**
 * The runner the UI passes into the leak test.
 *
 * It only ever sends the clean copy. The original is never part of a probe
 * request, so a cloud probe carries nothing the user was not going to send
 * to the assistant anyway, and the report can never quote a secret.
 */
export function createLeakRunner(): LeakRunner | null {
  if (!isFirebaseConfigured()) return null;

  return async (
    cleanCopy: string,
    removedTypes: string[],
    tier: Tier
  ): Promise<ModelRun> => {
    const message = leakUserMessage(cleanCopy, removedTypes);

    try {
      if (tier === "on_device") {
        const model = getLeakOnDeviceModel();
        await ensureDeviceReady(model);

        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: message, type: "text" }] }],
        });

        const raw = result.response.text();
        const ranOnDevice = result.response.inferenceSource !== "in_cloud";

        return {
          ok: true,
          raw,
          tier: "on_device",
          source: ranOnDevice ? "on_device" : "in_cloud",
          charsSent: ranOnDevice ? 0 : cleanCopy.length,
        };
      }

      const model = getLeakCloudModel();

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: message, type: "text" }] }],
      });

      return {
        ok: true,
        raw: result.response.text(),
        tier: "cloud",
        source: "in_cloud",
        charsSent: cleanCopy.length,
      };
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

let imageOnDeviceModel: GenerativeModel | null = null;
let imageCloudModel: GenerativeModel | null = null;

/**
 * The picture model has its own sessions, because the on-device session for a
 * picture has to be opened expecting an image as well as text. A session
 * opened for text alone cannot be handed a picture later.
 *
 * The instruction never changes, so there is one session for pictures and no
 * need to key anything by purpose.
 */
function getImageOnDeviceModel(): GenerativeModel {
  if (imageOnDeviceModel) return imageOnDeviceModel;

  const prompt = imagePrompt();

  imageOnDeviceModel = getGenerativeModel(getAi(), {
    mode: InferenceMode.ONLY_ON_DEVICE,
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: prompt },
    onDeviceParams: {
      createOptions: {
        expectedInputs: [
          { type: "text", languages: ["en"] },
          { type: "image" },
        ],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [
          {
            role: "system",
            content: [{ type: "text", value: prompt }],
          },
        ],
      },
    },
  });

  return imageOnDeviceModel;
}

function getImageCloudModel(): GenerativeModel {
  if (imageCloudModel) return imageCloudModel;

  imageCloudModel = getGenerativeModel(getAi(), {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: imagePrompt() },
  });

  return imageCloudModel;
}

function imageContents(image: ImageInput, context: ScanContext): Content[] {
  return [
    {
      role: "user",
      parts: [
        {
          text: imageUserMessage(context, image.width, image.height),
          type: "text",
        },
        {
          type: "inlineData",
          inlineData: { mimeType: image.mimeType, data: image.base64 },
        },
      ],
    },
  ];
}

async function runImageOnDevice(
  image: ImageInput,
  context: ScanContext
): Promise<ImageRun> {
  const model = getImageOnDeviceModel();
  await ensureDeviceReady(model);

  const result = await model.generateContent({
    contents: imageContents(image, context),
  });

  const ranOnDevice = result.response.inferenceSource !== "in_cloud";

  return {
    ok: true,
    raw: result.response.text(),
    tier: "on_device",
    source: ranOnDevice ? "on_device" : "in_cloud",
    bytesSent: ranOnDevice ? 0 : image.bytes,
  };
}

async function runImageInCloud(
  image: ImageInput,
  context: ScanContext
): Promise<ImageRun> {
  const model = getImageCloudModel();

  const result = await model.generateContent({
    contents: imageContents(image, context),
  });

  return {
    ok: true,
    raw: result.response.text(),
    tier: "cloud",
    source: "in_cloud",
    bytesSent: image.bytes,
  };
}

/**
 * The runner the UI passes into the picture scrubber.
 *
 * Like the text runner, it never escalates by itself: the caller decides,
 * because "never send this to a server" has to be a promise the app keeps.
 */
export function createImageRunner(): ImageRunner | null {
  if (!isFirebaseConfigured()) return null;

  return async (
    image: ImageInput,
    tier: Tier,
    context: ScanContext
  ): Promise<ImageRun> => {
    try {
      return tier === "on_device"
        ? await runImageOnDevice(image, context)
        : await runImageInCloud(image, context);
    } catch (error) {
      return {
        ok: false,
        raw: "",
        tier,
        source: tier === "cloud" ? "in_cloud" : "on_device",
        bytesSent: 0,
        error: describeError(error),
      };
    }
  };
}

