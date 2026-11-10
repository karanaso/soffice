import type { ComponentType } from "react";
import type { DocumentType } from "@/lib/documents/types";
import { DrawingEditor } from "@/app/features/drawing";
import { ExcelEditor } from "@/app/features/excel";
import { PowerPointEditor } from "@/app/features/powerpoint";
import { WordEditor } from "@/app/features/word";
import type { EditorProps } from "./editor-contract";

export interface EditorSurfaceProps extends EditorProps {
  type: DocumentType;
}

const EDITORS: Record<DocumentType, ComponentType<EditorProps>> = {
  word: WordEditor,
  excel: ExcelEditor,
  powerpoint: PowerPointEditor,
  drawing: DrawingEditor,
};

export function EditorSurface({ type, ...props }: EditorSurfaceProps) {
  const Editor = EDITORS[type];
  return <Editor {...props} />;
}
