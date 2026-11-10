"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  DOCUMENT_TYPE_LABELS,
  type Document,
  type DocumentType,
} from "@/lib/documents/types";
import { ApiClientError, documentsApi } from "../lib/api-client";
import {
  forgetLastDocument,
  rememberLastDocument,
} from "../lib/last-document";
import { DocumentShell } from "./DocumentShell";
import { NotFoundState } from "./NotFoundState";
import styles from "./DocumentWorkspace.module.css";

interface DocumentWorkspaceProps {
  type: DocumentType;
  id: string;
  load?: (id: string) => Promise<Document>;
  rename?: (id: string, name: string) => Promise<Document>;
  remove?: (id: string) => Promise<void>;
  navigate?: (href: string) => void;
  replace?: (href: string) => void;
}

type Status = "loading" | "ready" | "error" | "not_found";

export function DocumentWorkspace({
  type,
  id,
  load = documentsApi.get,
  rename = documentsApi.rename,
  remove = documentsApi.delete,
  navigate: navigateProp,
  replace: replaceProp,
}: DocumentWorkspaceProps) {
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
  const [doc, setDoc] = useState<Document | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;

    load(id)
      .then((loaded) => {
        if (!active) {
          return;
        }

        if (loaded.type !== type) {
          replace(`/${loaded.type}/${loaded.id}`);
          return;
        }

        setDoc(loaded);
        setStatus("ready");
        rememberLastDocument(loaded.type, loaded.id);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        if (loadError instanceof ApiClientError && loadError.status === 404) {
          setStatus("not_found");
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "The document could not be read.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [id, type, load, replace, retryToken]);

  useEffect(() => {
    if (doc) {
      document.title = `${doc.name} · ${DOCUMENT_TYPE_LABELS[doc.type]} · soffice`;
    }
  }, [doc]);

  async function handleRename(documentId: string, name: string): Promise<void> {
    const updated = await rename(documentId, name);
    setDoc(updated);
    rememberLastDocument(updated.type, updated.id);
  }

  function retryLoad(): void {
    setStatus("loading");
    setError(null);
    setRetryToken((token) => token + 1);
  }

  async function handleDelete(documentId: string): Promise<void> {
    await remove(documentId);
    forgetLastDocument(type, documentId);
    navigate("/");
  }

  if (status === "not_found") {
    return <NotFoundState />;
  }

  if (status === "error") {
    return (
      <section className={styles.state} role="alert">
        <p className={styles.kicker}>{DOCUMENT_TYPE_LABELS[type]}</p>
        <h1>We could not open this document</h1>
        <p>{error}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className="button button-primary"
            onClick={retryLoad}
          >
            Retry
          </button>
          <Link href="/" className="button">
            Back to Library
          </Link>
        </div>
      </section>
    );
  }

  if (status === "loading" || !doc) {
    return (
      <section
        className={styles.state}
        data-testid="shell-loading"
        aria-live="polite"
      >
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.kicker}>{DOCUMENT_TYPE_LABELS[type]}</p>
        <h1>Loading document…</h1>
        <p>Reading the file from storage.</p>
        <Link href="/" className="button button-quiet">
          Back to Library
        </Link>
      </section>
    );
  }

  return (
    <DocumentShell
      document={doc}
      onRename={handleRename}
      onDelete={handleDelete}
    />
  );
}
