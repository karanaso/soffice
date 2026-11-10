"use client";

import Link from "next/link";
import { useState } from "react";
import type { DocumentContent } from "@/lib/content/types";
import {
  DOCUMENT_TYPE_LABELS,
  type Document,
} from "@/lib/documents/types";
import { useDocumentContent, type SaveStatus } from "../lib/use-document-content";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { Dialog } from "./Dialog";
import { EditorSurface } from "./EditorSurface";
import { RenameDialog } from "./RenameDialog";
import styles from "./DocumentShell.module.css";

interface DocumentShellProps {
  document: Document;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loadContent?: (id: string) => Promise<DocumentContent>;
  saveContent?: (
    id: string,
    input: { revision: number; content: unknown },
    options?: { keepalive?: boolean },
  ) => Promise<DocumentContent>;
  debounceMs?: number;
}

const STATUS_LABELS: Record<SaveStatus, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Save failed",
  conflict: "Changed elsewhere",
};

function saveStatusClass(status: SaveStatus): string {
  if (status === "error") {
    return `${styles.saveStatus} ${styles.saveStatusError}`;
  }
  if (status === "conflict") {
    return `${styles.saveStatus} ${styles.saveStatusConflict}`;
  }
  if (status === "saving" || status === "dirty") {
    return `${styles.saveStatus} ${styles.saveStatusBusy}`;
  }
  return styles.saveStatus;
}

export function DocumentShell({
  document,
  onRename,
  onDelete,
  loadContent,
  saveContent,
  debounceMs,
}: DocumentShellProps) {
  const content = useDocumentContent({
    documentId: document.id,
    load: loadContent,
    save: saveContent,
    debounceMs,
  });
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const typeLabel = DOCUMENT_TYPE_LABELS[document.type];

  async function handleRename(id: string, name: string): Promise<void> {
    await onRename(id, name);
    setRenameOpen(false);
  }

  async function handleDelete(id: string): Promise<void> {
    await onDelete(id);
    setDeleteOpen(false);
  }

  function dismissConflict(): void {
    setConflictOpen(false);
    content.dismissConflict();
  }

  return (
    <section className={styles.shell} aria-labelledby="document-title">
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/" className={styles.libraryLink}>
          ← Library
        </Link>
        <span aria-hidden="true">/</span>
        <span>{typeLabel}</span>
      </nav>

      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <p className={styles.type}>{typeLabel}</p>
          <h1 id="document-title" className={styles.title}>
            {document.name}
          </h1>
        </div>
        <div className={styles.actions}>
          <span
            className={saveStatusClass(content.status)}
            data-testid="save-status"
            role="status"
            aria-live="polite"
          >
            {STATUS_LABELS[content.status]}
            {content.status === "error" ? (
              <button
                type="button"
                className={styles.statusAction}
                onClick={content.retrySave}
              >
                Retry
              </button>
            ) : null}
            {content.status === "conflict" ? (
              <button
                type="button"
                className={styles.statusAction}
                onClick={() => setConflictOpen(true)}
              >
                Reload
              </button>
            ) : null}
          </span>
          <button
            type="button"
            className="button"
            onClick={() => setRenameOpen(true)}
          >
            Rename
          </button>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </button>
        </div>
      </header>

      {content.loading ? (
        <section
          className={styles.contentState}
          data-testid="content-loading"
          aria-live="polite"
        >
          <span className={styles.spinner} aria-hidden="true" />
          <p>Loading editor…</p>
        </section>
      ) : content.loadError ? (
        <section
          className={`${styles.contentState} ${styles.contentError}`}
          data-testid="content-error"
          role="alert"
        >
          <p>We could not open the editor for this document.</p>
          <p className={styles.errorDetail}>{content.loadError}</p>
          <div className={styles.contentActions}>
            <button
              type="button"
              className="button button-primary"
              onClick={content.retryLoad}
            >
              Retry
            </button>
            <Link href="/" className="button button-quiet">
              Back to Library
            </Link>
          </div>
        </section>
      ) : (
        <EditorSurface
          key={`${document.id}:${content.contentVersion}`}
          type={document.type}
          documentId={document.id}
          initialContent={content.content}
          onChange={content.change}
        />
      )}

      <RenameDialog
        open={renameOpen}
        document={document}
        onClose={() => setRenameOpen(false)}
        onRename={handleRename}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        documentName={document.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => handleDelete(document.id)}
      />
      <Dialog
        open={conflictOpen}
        titleId="content-conflict-title"
        onClose={dismissConflict}
      >
        <h2 id="content-conflict-title" className={styles.conflictTitle}>
          This document changed elsewhere
        </h2>
        <p className={styles.conflictText}>
          Reloading replaces what is in this editor with the latest saved
          version. Keep your changes to continue editing without saving until
          you reload.
        </p>
        <div className={styles.conflictActions}>
          <button
            type="button"
            className="button button-quiet"
            onClick={dismissConflict}
          >
            Keep my changes
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setConflictOpen(false);
              void content.reloadLatest();
            }}
          >
            Reload latest
          </button>
        </div>
      </Dialog>
    </section>
  );
}
