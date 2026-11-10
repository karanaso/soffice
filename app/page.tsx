import type { Metadata } from "next";
import { FileLibrary } from "./components/FileLibrary";

export const metadata: Metadata = {
  title: "Library",
};

export default function HomePage() {
  return <FileLibrary />;
}
