import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { WorkspaceTabs } from "./components/WorkspaceTabs";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: {
    default: "soffice",
    template: "%s · soffice",
  },
  description: "A simple online office for schools.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className={styles.app}>
          <header className={styles.header}>
            <div className={styles.headerInner}>
              <Link href="/" className={styles.brand}>
                <span className={styles.brandMark} aria-hidden="true">
                  s
                </span>
                <span className={styles.brandText}>
                  soffice
                  <span className={styles.brandSub}>for schools</span>
                </span>
              </Link>
              <WorkspaceTabs />
            </div>
          </header>
          <main className={styles.main}>{children}</main>
          <footer className={styles.footer}>
            <p>Simple documents for the classroom. Stored on your school&apos;s server.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
