"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./WorkspaceTabs.module.css";

const TABS = [
  { href: "/", label: "Library", key: "library" },
  { href: "/word", label: "Word", key: "word" },
  { href: "/excel", label: "Excel", key: "excel" },
  { href: "/powerpoint", label: "PowerPoint", key: "powerpoint" },
  { href: "/drawing", label: "Drawing", key: "drawing" },
] as const;

export function isTabActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceTabs() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className={styles.nav} aria-label="Workspaces">
      <ul className={styles.list}>
        {TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                className={`${styles.tab} ${active ? styles.active : ""}`}
                aria-current={active ? "page" : undefined}
                data-testid={`tab-${tab.key}`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
