"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  DOCUMENT_TYPE_DESCRIPTIONS,
  DOCUMENT_TYPE_LABELS,
  type Document,
  type DocumentType,
} from "@/lib/documents/types";
import { documentsApi } from "../lib/api-client";
import {
  forgetLastDocument,
  readLastDocument,
} from "../lib/last-document";
import { documentHref, formatModified } from "../lib/presentation";
import { CreateDocumentDialog } from "./CreateDocumentDialog";
import styles from "./WorkspaceHome.module.css";

interface WorkspaceHomeProps {
  type: DocumentType;
  load?: () => Promise<Document[]>;
  create?: (input: {
    type: DocumentType;
    name?: string;
  }) => Promise<Document>;
  navigate?: (href: string) => void;
  replace?: (href: string) => void;
  readLast?: (type: DocumentType) => string | null;
  forgetLast?: (type: DocumentType, id?: string) => void;
}

type Status = "loading" | "ready" | "error";

export function WorkspaceHome({
  type,
  load = documentsApi.list,
  create = documentsApi.create,
  navigate: navigateProp,
  replace: replaceProp,
  readLast = readLastDocument,
  forgetLast = forgetLastDocument,
}: WorkspaceHomeProps) {
  const router = useRouter();
  const routerPush = router.push;
  const routerReplace = router.replace;
  const navigate = useCallback(
    (href: string) => {
      if (navigateProp) {
        navigateProp(href);
      } else {
        routerPush(href);
      }
    },
    [navigateProp, routerPush],
  );
  const replace = useCallback(
    (href: string) => {
      if (replaceProp) {
        replaceProp(href);
      } else {
        routerReplace(href);
      }
    },
    [replaceProp, routerReplace],
  );

  const [status, setStatus] = useState<Status>("loading");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const label = DOCUMENT_TYPE_LABELS[type];

  useEffect(() => {
    let active = true;

    load()
      .then((all) => {
        if (!active) {
          return;
        }

        const lastId = readLast(type);
        if (lastId) {
          const last = all.find((document) => document.id === lastId);
          if (last && last.type === type) {
            replace(documentHref(type, last.id));
            return;
          }
          forgetLast(type);
        }

        setDocuments(all.filter((document) => document.type === type));
        setStatus("ready");
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "The workspace could not be loaded.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [load, type, readLast, forgetLast, replace, retryToken]);

  function retryLoad(): void {
    setStatus("loading");
    setError(null);
    setRetryToken((token) => token + 1);
  }

  async function handleCreate(input: {
    type: DocumentType;
    name?: string;
  }): Promise<void> {
    const created = await create(input);
    setCreateOpen(false);
    navigate(documentHref(created.type, created.id));
  }

  return (
    <section className={styles.workspace} aria-labelledby="workspace-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Workspace</p>
          <h1 id="workspace-title" className={styles.title}>
            {label}
          </h1>
          <p className={styles.subtitle}>{DOCUMENT_TYPE_DESCRIPTIONS[type]}</p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setCreateOpen(true)}
        >
          <span aria-hidden="true">＋</span> New {label} document
        </button>
      </header>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Recent {label} files</h2>
        </div>

        {status === "error" ? (
          <div className={styles.state} role="alert">
            <h3>We could not load this workspace</h3>
            <p>{error}</p>
            <button type="button" className="button" onClick={retryLoad}>
              Retry
            </button>
          </div>
        ) : status === "loading" ? (
          <div
            className={styles.state}
            data-testid="workspace-loading"
            aria-live="polite"
          >
            <h3>Loading {label} files…</h3>
            <p>Checking for a recent document.</p>
          </div>
        ) : documents.length === 0 ? (
          <div className={styles.state} data-testid="workspace-empty">
            <div className={styles.mark} aria-hidden="true">
              ◻
            </div>
            <h3>No {label} documents yet</h3>
            <p>
              Create one here, or use the Library tab to create any kind of
              document.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setCreateOpen(true)}
            >
              Create a {label} document
            </button>
          </div>
        ) : (
          <ul className={styles.list} data-testid="workspace-recent">
            {documents.map((document) => (
              <li key={document.id}>
                <Link
                  href={documentHref(document.type, document.id)}
                  className={styles.item}
                >
                  <span className={styles.itemName}>{document.name}</span>
                  <time
                    className={styles.itemMeta}
                    dateTime={document.updatedAt}
                  >
                    {formatModified(document.updatedAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateDocumentDialog
        open={createOpen}
        initialType={type}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </section>
  );
}
