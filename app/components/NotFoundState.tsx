import Link from "next/link";
import styles from "./NotFoundState.module.css";

export function NotFoundState({
  title = "Document not found",
  message = "This document may have been deleted or the address may be incorrect.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <section className={styles.state} aria-labelledby="not-found-title">
      <p className={styles.code} aria-hidden="true">
        404
      </p>
      <h1 id="not-found-title">{title}</h1>
      <p>{message}</p>
      <Link href="/" className="button button-primary">
        Back to Library
      </Link>
    </section>
  );
}
