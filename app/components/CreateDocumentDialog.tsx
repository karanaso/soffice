"use client";

import { useState, type FormEvent } from "react";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_DESCRIPTIONS,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/documents/types";
import { Dialog } from "./Dialog";
import styles from "./Dialog.module.css";

interface CreateDocumentDialogProps {
  open: boolean;
  initialType?: DocumentType;
  onClose: () => void;
  onCreate: (input: { type: DocumentType; name?: string }) => Promise<void>;
}

export function CreateDocumentDialog({
  open,
  initialType = "word",
  onClose,
  onCreate,
}: CreateDocumentDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <CreateDocumentDialogContent
      initialType={initialType}
      onClose={onClose}
      onCreate={onCreate}
    />
  );
}

function CreateDocumentDialogContent({
  initialType,
  onClose,
  onCreate,
}: Omit<CreateDocumentDialogProps, "open"> & { initialType: DocumentType }) {
  const [type, setType] = useState<DocumentType>(initialType);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const trimmed = name.trim();
    try {
      await onCreate({ type, name: trimmed === "" ? undefined : trimmed });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The document could not be created. Please retry.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Dialog open titleId="create-document-title" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2 id="create-document-title" className={styles.title}>
          New document
        </h2>
        <p className={styles.description}>
          Choose a workspace and give the file a name. You can rename it later.
        </p>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="document-type">
            Type
          </label>
          <select
            id="document-type"
            className={styles.select}
            value={type}
            onChange={(event) => setType(event.target.value as DocumentType)}
          >
            {DOCUMENT_TYPES.map((documentType) => (
              <option key={documentType} value={documentType}>
                {DOCUMENT_TYPE_LABELS[documentType]} —{" "}
                {DOCUMENT_TYPE_DESCRIPTIONS[documentType]}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="document-name">
            Name (optional)
          </label>
          <input
            id="document-name"
            className={styles.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder={`Untitled ${DOCUMENT_TYPE_LABELS[type]} document`}
            autoComplete="off"
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
            {submitting ? "Creating…" : "Create document"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
