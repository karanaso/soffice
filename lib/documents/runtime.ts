import type { DatabaseClient } from "../db/client";
import { createDatabase } from "../db/create";
import { loadConfig } from "../config";
import { PostgresDocumentRepository } from "./postgres-repository";
import type { DocumentRepository } from "./repository";
import { createDocumentService, type DocumentService } from "./service";
import { SqliteDocumentRepository } from "./sqlite-repository";

let databasePromise: Promise<DatabaseClient> | null = null;
let repositoryPromise: Promise<DocumentRepository> | null = null;
let servicePromise: Promise<DocumentService> | null = null;

export function getDatabase(): Promise<DatabaseClient> {
  if (!databasePromise) {
    databasePromise = Promise.resolve(createDatabase(loadConfig()));
  }
  return databasePromise;
}

export async function getDocumentRepository(): Promise<DocumentRepository> {
  if (!repositoryPromise) {
    repositoryPromise = getDatabase().then((database) =>
      database.dialect === "postgres"
        ? new PostgresDocumentRepository(database)
        : new SqliteDocumentRepository(database),
    );
  }
  return repositoryPromise;
}

export async function getDocumentService(): Promise<DocumentService> {
  if (!servicePromise) {
    servicePromise = getDocumentRepository().then((repository) =>
      createDocumentService(repository),
    );
  }
  return servicePromise;
}

export async function resetRuntimeForTests(): Promise<void> {
  const database = databasePromise ? await databasePromise.catch(() => null) : null;
  databasePromise = null;
  repositoryPromise = null;
  servicePromise = null;
  if (database) {
    await database.close().catch(() => undefined);
  }
}
