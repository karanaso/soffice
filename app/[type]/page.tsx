import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DOCUMENT_TYPE_LABELS,
  isDocumentType,
} from "@/lib/documents/types";
import { WorkspaceHome } from "../components/WorkspaceHome";

interface TypePageProps {
  params: Promise<{ type: string }>;
}

export async function generateMetadata({
  params,
}: TypePageProps): Promise<Metadata> {
  const { type } = await params;
  return {
    title: isDocumentType(type) ? DOCUMENT_TYPE_LABELS[type] : "Not found",
  };
}

export default async function WorkspacePage({ params }: TypePageProps) {
  const { type } = await params;
  if (!isDocumentType(type)) {
    notFound();
  }

  return <WorkspaceHome key={type} type={type} />;
}
