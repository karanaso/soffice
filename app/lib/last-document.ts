import type { DocumentType } from "@/lib/documents/types";

const PREFIX = "soffice:last-document:";

function storage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberLastDocument(type: DocumentType, id: string): void {
  storage()?.setItem(`${PREFIX}${type}`, id);
}

export function readLastDocument(type: DocumentType): string | null {
  return storage()?.getItem(`${PREFIX}${type}`) ?? null;
}

export function forgetLastDocument(
  type: DocumentType,
  id?: string,
): void {
  const store = storage();
  if (!store) {
    return;
  }

  if (id === undefined || store.getItem(`${PREFIX}${type}`) === id) {
    store.removeItem(`${PREFIX}${type}`);
  }
}
