"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DOCUMENT_TYPE_LABELS,
  type Document,
  type DocumentType,
} from "@/lib/documents/types";
import { documentsApi } from "../lib/api-client";
import { forgetLastDocument } from "../lib/last-document";
import { documentHref, formatModified } from "../lib/presentation";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { CreateDocumentDialog } from "./CreateDocumentDialog";
import { RenameDialog } from "./RenameDialog";
import styles from "./FileLibrary.module.css";

export interface FileLibraryProps {
  load?: () => Promise<Document[]>;
  create?: (input: {
    type: DocumentType;
    name?: string;
  }) => Promise<Document>;
  rename?: (id: string, name: string) => Promise<Document>;
  remove?: (id: string) => Promise<void>;
  navigate?: (href: string) => void;
}

export function FileLibrary({
  load = documentsApi.list,
  create = documentsApi.create,
  rename = documentsApi.rename,
  remove = documentsApi.delete,
  navigate: navigateProp,
}: FileLibraryProps) {
  const router = useRouter();
  const navigate = navigateProp ?? ((href: string) => router.push(href));

  const [documents, setDocuments] = useState<Document[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);

  useEffect(() => {
    let active = true;

    load()
      .then((next) => {
        if (active) {
          setDocuments(next);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "The document list could not be loaded.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [load, reloadToken]);

  function retryLoad(): void {
    setDocuments(null);
    setLoadError(null);
    setReloadToken((token) => token + 1);
  }

  async function handleCreate(input: {
    type: DocumentType;
    name?: string;
  }): Promise<void> {
    const created = await create(input);
    setDocuments((current) =>
      current ? [created, ...current] : [created],
    );
    setCreateOpen(false);
    navigate(documentHref(created.type, created.id));
  }

  async function handleRename(id: string, name: string): Promise<void> {
    const updated = await rename(id, name);
    setDocuments((current) =>
      current
        ? current.map((document) =>
            document.id === updated.id ? updated : document,
          )
        : current,
    );
    setRenameTarget(null);
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) {
      return;
    }

    await remove(deleteTarget.id);
    forgetLastDocument(deleteTarget.type, deleteTarget.id);
    setDocuments((current) =>
      current
        ? current.filter((document) => document.id !== deleteTarget.id)
        : current,
    );
    setDeleteTarget(null);
  }

  return (
    <section className={styles.library} aria-labelledby="library-title">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Your workspace</p>
          <h1 id="library-title" className={styles.title}>
            Library
          </h1>
          <p className={styles.subtitle}>
            Every document for your classroom, in one place.
          </p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setCreateOpen(true)}
        >
          <span aria-hidden="true">＋</span> New document
        </button>
      </header>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>All files</h2>
          {documents ? (
            <span className={styles.count} data-testid="document-count">
              {documents.length} {documents.length === 1 ? "file" : "files"}
            </span>
          ) : null}
        </div>

        {loadError ? (
          <div className={styles.state} role="alert">
            <h3>We could not load your files</h3>
            <p>{loadError}</p>
            <button type="button" className="button" onClick={retryLoad}>
              Retry
            </button>
          </div>
        ) : documents === null ? (
          <div className={styles.state} aria-live="polite">
            <h3>Loading documents…</h3>
            <p>Fetching your library from storage.</p>
            <div className={styles.skeleton} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyMark} aria-hidden="true">
              ▤
            </div>
            <h3>No documents yet</h3>
            <p>
              Create a Word, Excel, PowerPoint, or Drawing document to get
              started.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setCreateOpen(true)}
            >
              Create your first document
            </button>
          </div>
        ) : (
          <ul className={styles.list} data-testid="document-list">
            {documents.map((document) => (
              <li key={document.id} className={styles.row}>
                <Link
                  href={documentHref(document.type, document.id)}
                  className={styles.primary}
                >
                  <span
                    className={`${styles.badge} ${styles[document.type]}`}
                    aria-hidden="true"
                  >
                    {DOCUMENT_TYPE_LABELS[document.type].slice(0, 1)}
                  </span>
                  <span className={styles.fileText}>
                    <span className={styles.fileName}>{document.name}</span>
                    <span className={styles.meta}>
                      {DOCUMENT_TYPE_LABELS[document.type]}
                      <span aria-hidden="true"> · </span>
                      <time dateTime={document.updatedAt}>
                        {formatModified(document.updatedAt)}
                      </time>
                    </span>
                  </span>
                </Link>
                <div className={styles.rowActions}>
                  <Link
                    href={documentHref(document.type, document.id)}
                    className="button button-quiet"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setRenameTarget(document)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setDeleteTarget(document)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateDocumentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <RenameDialog
        open={renameTarget !== null}
        document={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={handleRename}
      />
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        documentName={deleteTarget?.name ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
}
