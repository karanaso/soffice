import type { DatabaseClient } from "../db/client";
import type { StoredContent } from "../content/types";
import { ContentConflictError } from "../content/errors";
import { NameConflictError, NotFoundError } from "./errors";
import { normalizeDocumentName } from "./names";
import {
  nextUpdatedAt,
  type CreateDocumentInput,
  type DocumentRepository,
  type RepositoryOptions,
  type SaveContentInput,
} from "./repository";
import { isUniqueViolation } from "./sql-errors";
import type { Document, DocumentType } from "./types";

interface DocumentRow {
  id: string;
  name: string;
  type: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ContentRow {
  document_id: string;
  revision: number;
  content: unknown;
  updated_at: Date | string;
}

function toStoredContent(row: ContentRow): StoredContent {
  return {
    documentId: row.document_id,
    revision: Number(row.revision),
    content:
      typeof row.content === "string" ? row.content : JSON.stringify(row.content),
    updatedAt: toIso(row.updated_at),
  };
}


function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DocumentType,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

const SELECT_COLUMNS = "id, name, type, created_at, updated_at";

export class PostgresDocumentRepository implements DocumentRepository {
  readonly backend = "postgres" as const;

  private readonly now: () => Date;

  constructor(
    private readonly database: DatabaseClient,
    options: RepositoryOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async list(): Promise<Document[]> {
    const rows = await this.database.query<DocumentRow>(
      `SELECT ${SELECT_COLUMNS} FROM documents ORDER BY updated_at DESC, id ASC`,
    );
    return rows.map(toDocument);
  }

  async get(id: string): Promise<Document | null> {
    const rows = await this.database.query<DocumentRow>(
      `SELECT ${SELECT_COLUMNS} FROM documents WHERE id = $1`,
      [id],
    );
    return rows[0] ? toDocument(rows[0]) : null;
  }

  async create(input: CreateDocumentInput): Promise<Document> {
    const { name, nameKey } = normalizeDocumentName(input.name);
    const timestamp = this.now().toISOString();

    try {
      await this.database.run(
        `INSERT INTO documents (id, name, name_key, type, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [input.id, name, nameKey, input.type, timestamp, timestamp],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NameConflictError();
      }
      throw error;
    }

    return {
      id: input.id,
      name,
      type: input.type,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  async rename(id: string, nameInput: string): Promise<Document> {
    const current = await this.get(id);
    if (!current) {
      throw new NotFoundError();
    }

    const { name, nameKey } = normalizeDocumentName(nameInput);
    const updatedAt = nextUpdatedAt(current.updatedAt, this.now());

    try {
      const changed = await this.database.run(
        `UPDATE documents SET name = $1, name_key = $2, updated_at = $3 WHERE id = $4`,
        [name, nameKey, updatedAt, id],
      );
      if (changed === 0) {
        throw new NotFoundError();
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new NameConflictError();
      }
      throw error;
    }

    return { ...current, name, updatedAt };
  }

  async delete(id: string): Promise<boolean> {
    const changed = await this.database.run(
      "DELETE FROM documents WHERE id = $1",
      [id],
    );
    return changed > 0;
  }

  async getContent(documentId: string): Promise<StoredContent | null> {
    const rows = await this.database.query<ContentRow>(
      "SELECT document_id, revision, content, updated_at FROM document_contents WHERE document_id = $1",
      [documentId],
    );
    return rows[0] ? toStoredContent(rows[0]) : null;
  }

  async saveContent(input: SaveContentInput): Promise<StoredContent> {
    const now = this.now();
    const timestamp = now.toISOString();

    return this.database.transaction(async (tx) => {
      const documents = await tx.query<{ updated_at: Date | string }>(
        "SELECT updated_at FROM documents WHERE id = $1",
        [input.documentId],
      );
      const current = documents[0];
      if (!current) {
        throw new NotFoundError();
      }

      if (input.revision === 0) {
        try {
          await tx.run(
            `INSERT INTO document_contents (document_id, revision, content, updated_at)
             VALUES ($1, 1, $2::jsonb, $3)`,
            [input.documentId, input.content, timestamp],
          );
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ContentConflictError();
          }
          throw error;
        }
      } else {
        const changed = await tx.run(
          `UPDATE document_contents
           SET revision = revision + 1, content = $1::jsonb, updated_at = $2
           WHERE document_id = $3 AND revision = $4`,
          [input.content, timestamp, input.documentId, input.revision],
        );
        if (changed === 0) {
          throw new ContentConflictError();
        }
      }

      const documentUpdatedAt = nextUpdatedAt(toIso(current.updated_at), now);
      await tx.run("UPDATE documents SET updated_at = $1 WHERE id = $2", [
        documentUpdatedAt,
        input.documentId,
      ]);

      return {
        documentId: input.documentId,
        revision: input.revision + 1,
        content: input.content,
        updatedAt: timestamp,
      };
    });
  }

  async ping(): Promise<void> {
    await this.database.ping();
  }

  async close(): Promise<void> {
    await this.database.close();
  }
}
