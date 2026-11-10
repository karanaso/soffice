"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentContent } from "@/lib/content/types";
import {
  ApiClientError,
  documentsApi,
} from "./api-client";

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

export interface UseDocumentContentOptions {
  documentId: string;
  load?: (id: string) => Promise<DocumentContent>;
  save?: (
    id: string,
    input: { revision: number; content: unknown },
    options?: { keepalive?: boolean },
  ) => Promise<DocumentContent>;
  debounceMs?: number;
}

export interface UseDocumentContentResult {
  content: unknown;
  revision: number;
  contentVersion: number;
  status: SaveStatus;
  loading: boolean;
  loadError: string | null;
  saveError: string | null;
  change: (content: unknown) => void;
  retryLoad: () => void;
  retrySave: () => void;
  saveNow: () => Promise<void>;
  reloadLatest: () => Promise<void>;
  dismissConflict: () => void;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useDocumentContent({
  documentId,
  load = documentsApi.getContent,
  save = documentsApi.saveContent,
  debounceMs = 700,
}: UseDocumentContentOptions): UseDocumentContentResult {
  const [content, setContent] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  const [contentVersion, setContentVersion] = useState(0);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadToken, setLoadToken] = useState(0);

  const contentRef = useRef<unknown>(null);
  const revisionRef = useRef(0);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const conflictRef = useRef(false);
  const saveRef = useRef(save);
  const loadRef = useRef(load);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const applyLoaded = useCallback((loaded: DocumentContent) => {
    contentRef.current = loaded.content;
    revisionRef.current = loaded.revision;
    dirtyRef.current = false;
    savingRef.current = false;
    conflictRef.current = false;
    setContent(loaded.content);
    setRevision(loaded.revision);
    setContentVersion((version) => version + 1);
    setStatus("saved");
    setSaveError(null);
    setLoading(false);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let active = true;

    loadRef.current(documentId)
      .then((loaded) => {
        if (active) {
          applyLoaded(loaded);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        setLoading(false);
        setLoadError(
          messageOf(error, "The document content could not be read."),
        );
      });

    return () => {
      active = false;
    };
  }, [applyLoaded, documentId, loadToken]);

  const performSave = useCallback(
    async (options: { keepalive?: boolean } = {}): Promise<void> => {
      if (
        savingRef.current ||
        conflictRef.current ||
        contentRef.current === null
      ) {
        return;
      }

      const snapshot = contentRef.current;
      const baseRevision = revisionRef.current;
      savingRef.current = true;
      setStatus("saving");
      setSaveError(null);

      try {
        const saved = await saveRef.current(
          documentId,
          { revision: baseRevision, content: snapshot },
          options,
        );
        revisionRef.current = saved.revision;
        setRevision(saved.revision);
        if (contentRef.current === snapshot) {
          dirtyRef.current = false;
        }
        setStatus(dirtyRef.current ? "dirty" : "saved");
      } catch (error: unknown) {
        dirtyRef.current = true;
        if (error instanceof ApiClientError && error.status === 409) {
          conflictRef.current = true;
          setStatus("conflict");
          setSaveError(error.message);
        } else {
          setStatus("error");
          setSaveError(
            messageOf(error, "Your changes could not be saved. Retry to try again."),
          );
        }
      } finally {
        savingRef.current = false;
      }
    },
    [documentId],
  );

  useEffect(() => {
    if (
      !dirtyRef.current ||
      savingRef.current ||
      conflictRef.current ||
      saveError ||
      loading ||
      loadError
    ) {
      return;
    }

    const timer = setTimeout(() => {
      void performSave();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [content, debounceMs, loadError, loading, performSave, revision, saveError, status]);

  const change = useCallback((next: unknown) => {
    contentRef.current = next;
    dirtyRef.current = true;
    setContent(next);
    setSaveError(null);
    setStatus("dirty");
  }, []);

  const retryLoad = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    setLoadToken((token) => token + 1);
  }, []);

  const retrySave = useCallback(() => {
    if (conflictRef.current) {
      return;
    }
    setSaveError(null);
    setStatus("dirty");
    void performSave();
  }, [performSave]);

  const saveNow = useCallback(async () => {
    await performSave();
  }, [performSave]);

  const reloadLatest = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadToken((token) => token + 1);
  }, []);

  const dismissConflict = useCallback(() => {
    // Saving stays paused; only the prompt is dismissed.
    setSaveError(null);
  }, []);

  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current && !conflictRef.current) {
        void performSave({ keepalive: true });
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [performSave]);

  useEffect(() => {
    if (!dirtyRef.current) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      void performSave({ keepalive: true });
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [performSave, status]);

  return {
    content,
    revision,
    contentVersion,
    status,
    loading,
    loadError,
    saveError,
    change,
    retryLoad,
    retrySave,
    saveNow,
    reloadLatest,
    dismissConflict,
  };
}
