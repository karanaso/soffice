"use client";

import Link from "next/link";
import { useState } from "react";
import {
  DOCUMENT_TYPE_LABELS,
  type Document,
} from "@/lib/documents/types";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { EditorSurface } from "./EditorSurface";
import { RenameDialog } from "./RenameDialog";
import styles from "./DocumentShell.module.css";

interface DocumentShellProps {
  document: Document;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function DocumentShell({
  document,
  onRename,
  onDelete,
}: DocumentShellProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const typeLabel = DOCUMENT_TYPE_LABELS[document.type];

  async function handleRename(id: string, name: string): Promise<void> {
    await onRename(id, name);
    setRenameOpen(false);
  }

  async function handleDelete(id: string): Promise<void> {
    await onDelete(id);
    setDeleteOpen(false);
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
          <span className={styles.readonlyBadge}>Read-only</span>
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

      <div className={styles.notice} role="status">
        <span className={styles.noticeIcon} aria-hidden="true">
          ◌
        </span>
        <p>
          Editing tools for {typeLabel} are not available in this release. This
          document is read-only.
        </p>
      </div>

      <EditorSurface type={document.type} />

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
    </section>
  );
}
