import type { ContentCodecMap } from "./types";

/**
 * Temporary permissive codecs used until the feature codecs land during
 * integration. The integration task replaces each entry with the feature's
 * codec from `lib/features/<type>/content.ts`.
 */
const passthrough = {
  empty: () => ({}),
  parse: (input: unknown) => input,
};

export const contentCodecs: ContentCodecMap = {
  word: passthrough,
  excel: passthrough,
  powerpoint: passthrough,
  drawing: passthrough,
};
