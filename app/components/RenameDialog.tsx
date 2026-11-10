"use client";

import { useState, type FormEvent } from "react";
import { MAX_DOCUMENT_NAME_LENGTH } from "@/lib/documents/names";
import type { Document } from "@/lib/documents/types";
import { Dialog } from "./Dialog";
import styles from "./Dialog.module.css";

interface RenameDialogProps {
  open: boolean;
  document: Pick<Document, "id" | "name"> | null;
  onClose: () => void;
  onRename: (id: string, name: string) => Promise<void>;
}

export function RenameDialog({
  open,
  document,
  onClose,
  onRename,
}: RenameDialogProps) {
  if (!open || !document) {
    return null;
  }

  return (
    <RenameDialogContent
      document={document}
      onClose={onClose}
      onRename={onRename}
    />
  );
}

function RenameDialogContent({
  document,
  onClose,
  onRename,
}: Omit<RenameDialogProps, "open" | "document"> & {
  document: Pick<Document, "id" | "name">;
}) {
  const [name, setName] = useState(document.name);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("Document name cannot be empty.");
      return;
    }
    if (Array.from(trimmed).length > MAX_DOCUMENT_NAME_LENGTH) {
      setError(
        `Document name must be ${MAX_DOCUMENT_NAME_LENGTH} characters or fewer.`,
      );
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onRename(document.id, trimmed);
    } catch (renameError) {
      setError(
        renameError instanceof Error
          ? renameError.message
          : "The document could not be renamed. Please retry.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Dialog open titleId="rename-document-title" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2 id="rename-document-title" className={styles.title}>
          Rename document
        </h2>
        <p className={styles.description}>
          Names can be up to {MAX_DOCUMENT_NAME_LENGTH} characters and must be
          unique.
        </p>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="rename-document-name">
            Name
          </label>
          <input
            id="rename-document-name"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_DOCUMENT_NAME_LENGTH}
            autoComplete="off"
            autoFocus
          />
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
