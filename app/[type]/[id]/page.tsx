import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DOCUMENT_TYPE_LABELS,
  isDocumentType,
} from "@/lib/documents/types";
import { DocumentWorkspace } from "../../components/DocumentWorkspace";

interface DocumentPageProps {
  params: Promise<{ type: string; id: string }>;
}

export async function generateMetadata({
  params,
}: DocumentPageProps): Promise<Metadata> {
  const { type } = await params;
  return {
    title: isDocumentType(type)
      ? `${DOCUMENT_TYPE_LABELS[type]} document`
      : "Not found",
  };
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { type, id } = await params;
  if (!isDocumentType(type)) {
    notFound();
  }

  return <DocumentWorkspace key={id} type={type} id={id} />;
}
