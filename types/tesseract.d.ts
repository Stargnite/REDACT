declare module "tesseract.js/dist/tesseract.esm.min.js" {
  export function createWorker(
    langs: string | string[],
    oem?: number,
    options?: Record<string, unknown>
  ): Promise<{
    recognize: (
      image: unknown,
      options?: unknown,
      output?: unknown
    ) => Promise<{ data: { blocks?: unknown } }>;
    terminate: () => Promise<unknown>;
  }>;
}
