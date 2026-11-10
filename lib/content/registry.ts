import { wordCodec } from "../features/word/content";
import { drawingCodec } from "../features/drawing/content";
import { excelCodec } from "../features/excel/content";
import { powerpointCodec } from "../features/powerpoint/content";
import type { ContentCodecMap } from "./types";

export const contentCodecs: ContentCodecMap = {
  word: wordCodec,
  excel: excelCodec,
  powerpoint: powerpointCodec,
  drawing: drawingCodec,
};
