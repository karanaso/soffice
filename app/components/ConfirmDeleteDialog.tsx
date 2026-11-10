"use client";

import { useState } from "react";
import { Dialog } from "./Dialog";
import styles from "./Dialog.module.css";

interface ConfirmDeleteDialogProps {
  open: boolean;
  documentName: string | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDeleteDialog({
  open,
  documentName,
  onClose,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  if (!open || documentName === null) {
    return null;
  }

  return (
    <ConfirmDeleteDialogContent
      documentName={documentName}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function ConfirmDeleteDialogContent({
  documentName,
  onClose,
  onConfirm,
}: Omit<ConfirmDeleteDialogProps, "open" | "documentName"> & {
  documentName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "The document could not be deleted. Please retry.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Dialog open titleId="delete-document-title" onClose={onClose}>
      <h2 id="delete-document-title" className={styles.title}>
        Delete “{documentName}”?
      </h2>
      <p className={styles.description}>
        This permanently removes the document from the library. This cannot be
        undone.
      </p>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

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
          type="button"
          className="button button-danger"
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? "Deleting…" : "Delete document"}
        </button>
      </div>
    </Dialog>
  );
}
