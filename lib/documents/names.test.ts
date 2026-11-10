import { describe, expect, it } from "vitest";
import { ValidationError } from "./errors";
import {
  MAX_DOCUMENT_NAME_LENGTH,
  documentNameKey,
  normalizeDocumentName,
  validateDocumentName,
} from "./names";

describe("validateDocumentName", () => {
  it("trims surrounding whitespace", () => {
    expect(validateDocumentName("  Lesson plan  ")).toBe("Lesson plan");
  });

  it("rejects empty and whitespace-only names", () => {
    expect(() => validateDocumentName("")).toThrow(ValidationError);
    expect(() => validateDocumentName("   ")).toThrow(ValidationError);
    expect(() => validateDocumentName(undefined)).toThrow(ValidationError);
  });

  it("accepts exactly 120 characters and rejects 121", () => {
    const accepted = "a".repeat(MAX_DOCUMENT_NAME_LENGTH);
    const rejected = "a".repeat(MAX_DOCUMENT_NAME_LENGTH + 1);
    expect(validateDocumentName(accepted)).toBe(accepted);
    expect(() => validateDocumentName(rejected)).toThrow(
      /120 characters or fewer/,
    );
  });

  it("counts Unicode code points rather than UTF-16 units", () => {
    const emojiName = "📚".repeat(MAX_DOCUMENT_NAME_LENGTH);
    expect(validateDocumentName(emojiName)).toBe(emojiName);
  });
});

describe("documentNameKey", () => {
  it("is case-insensitive", () => {
    expect(documentNameKey("Lesson Plan")).toBe("lesson plan");
    expect(documentNameKey("LESSON PLAN")).toBe("lesson plan");
  });

  it("applies NFKC normalization", () => {
    expect(documentNameKey("ＳＯＦＦＩＣＥ")).toBe("soffice");
    expect(documentNameKey("Café")).toBe(documentNameKey("Cafe\u0301"));
  });

  it("normalizes before returning a name and key", () => {
    expect(normalizeDocumentName("  Report  ")).toEqual({
      name: "Report",
      nameKey: "report",
    });
  });
});
