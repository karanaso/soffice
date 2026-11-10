import { randomUUID } from "node:crypto";
import { NameConflictError, NotFoundError, ValidationError } from "./errors";
import type { CreateDocumentInput, DocumentRepository } from "./repository";
import {
  DOCUMENT_TYPE_LABELS,
  isDocumentType,
  type Document,
  type DocumentType,
} from "./types";

export interface CreateDocumentRequest {
  type: unknown;
  name?: unknown;
}

export interface DocumentService {
  list(): Promise<Document[]>;
  get(id: string): Promise<Document | null>;
  create(request: CreateDocumentRequest): Promise<Document>;
  rename(id: string, name: unknown): Promise<Document>;
  delete(id: string): Promise<boolean>;
}

function isBlankName(name: unknown): boolean {
  return name === undefined || (typeof name === "string" && name.trim() === "");
}

export class RepositoryDocumentService implements DocumentService {
  constructor(
    private readonly repository: DocumentRepository,
    private readonly generateId: () => string = () => randomUUID(),
  ) {}

  list(): Promise<Document[]> {
    return this.repository.list();
  }

  get(id: string): Promise<Document | null> {
    return this.repository.get(id);
  }

  async create(request: CreateDocumentRequest): Promise<Document> {
    if (!isDocumentType(request.type)) {
      throw new ValidationError(
        "Choose a document type: word, excel, powerpoint, or drawing.",
      );
    }

    const type: DocumentType = request.type;

    if (!isBlankName(request.name)) {
      return this.repository.create({
        id: this.generateId(),
        name: request.name as string,
        type,
      });
    }

    const baseName = `Untitled ${DOCUMENT_TYPE_LABELS[type]} document`;
    for (let attempt = 1; attempt <= 100; attempt += 1) {
      const name = attempt === 1 ? baseName : `${baseName} ${attempt}`;
      const input: CreateDocumentInput = {
        id: this.generateId(),
        name,
        type,
      };

      try {
        return await this.repository.create(input);
      } catch (error) {
        if (error instanceof NameConflictError) {
          continue;
        }
        throw error;
      }
    }

    throw new ValidationError(
      "Could not generate a unique default name. Enter a document name.",
    );
  }

  async rename(id: string, name: unknown): Promise<Document> {
    if (typeof name !== "string") {
      throw new ValidationError("Document name must be text.");
    }
    return this.repository.rename(id, name);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundError();
    }
    return true;
  }
}

export function createDocumentService(
  repository: DocumentRepository,
  generateId?: () => string,
): DocumentService {
  return new RepositoryDocumentService(repository, generateId);
}
