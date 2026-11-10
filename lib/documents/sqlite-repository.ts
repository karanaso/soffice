import type { DatabaseClient } from "../db/client";
import { NameConflictError, NotFoundError } from "./errors";
import { normalizeDocumentName } from "./names";
import {
  nextUpdatedAt,
  type CreateDocumentInput,
  type DocumentRepository,
  type RepositoryOptions,
} from "./repository";
import { isUniqueViolation } from "./sql-errors";
import type { Document, DocumentType } from "./types";

interface DocumentRow {
  id: string;
  name: string;
  type: string;
  created_at: string;
  updated_at: string;
}

function toDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DocumentType,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const SELECT_COLUMNS = "id, name, type, created_at, updated_at";

export class SqliteDocumentRepository implements DocumentRepository {
  readonly backend = "sqlite" as const;

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
      `SELECT ${SELECT_COLUMNS} FROM documents WHERE id = ?`,
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
         VALUES (?, ?, ?, ?, ?, ?)`,
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
        `UPDATE documents SET name = ?, name_key = ?, updated_at = ? WHERE id = ?`,
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
      "DELETE FROM documents WHERE id = ?",
      [id],
    );
    return changed > 0;
  }

  async ping(): Promise<void> {
    await this.database.ping();
  }

  async close(): Promise<void> {
    await this.database.close();
  }
}
