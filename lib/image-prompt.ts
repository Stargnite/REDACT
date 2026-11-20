import { TYPES } from "./prompt";
import { purposeInstruction } from "./purpose";
import type { ScanContext } from "./types";

/**
 * The instruction for finding sensitive things in a picture.
 *
 * The system instruction never changes, so one on-device session serves every
 * purpose. The purpose travels in the user turn with the size of the image.
 */

const BASE_RULES = `Rules:
1. You are looking at a screenshot. Find every region of it that holds sensitive information: a name, an email address, a phone number, a home address, an employer, a location, an account number, an API key, a card number, a signature.
2. A region is a rectangle drawn tightly around the sensitive characters or field. Do not include whole panels, buttons or backgrounds.
3. Report a region only when you can actually see it. If you are not confident, leave it out. A false positive costs the user more trust than a miss costs them safety.
4. Do not report the same region twice.
5. Report nothing at all if the image holds nothing sensitive.`;

export const IMAGE_OUTPUT_SHAPE =
  '{"regions": [{"type": "EMAIL", "box": {"x": 120, "y": 300, "width": 400, "height": 40}}]}';

/**
 * The system instruction for one image scan.
 *
 * It says nothing about the purpose, because the on-device session is created
 * once and lives for the whole session.
 */
export function imageInstruction(): string {
  return `You are a redaction scanner for images. You are shown a picture of a screen, a message, a document or a form, and you report where the sensitive parts of it are.

${BASE_RULES}

The type of every region must be one of: ${TYPES.join(", ")}.`;
}

/** The JSON shape the model has to answer with. */
export function imageSchemaHint(): string {
  return `Return ONLY JSON, with this exact shape and nothing else:
${IMAGE_OUTPUT_SHAPE}

Coordinates are normalised to 0-1000 for the whole image. x and y are the top-left corner of the region, width and height are its size.`;
}

/**
 * The user turn: what the image is for, how big it is, and the image itself.
 */
export function imageUserMessage(
  context: ScanContext,
  width: number,
  height: number
): string {
  return `Purpose:
${purposeInstruction(context)}

The image is ${width} x ${height} pixels. Report every region that would be sensitive if this image were sent to an assistant.`;
}

/** The whole prompt, for whichever tier is running. */
export function imagePrompt(): string {
  return `${imageInstruction()}\n\n${imageSchemaHint()}`;
}
