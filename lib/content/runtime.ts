import { getDocumentRepository } from "../documents/runtime";
import { contentCodecs } from "./registry";
import { createContentService, type ContentService } from "./service";

let servicePromise: Promise<ContentService> | null = null;

export function getContentService(): Promise<ContentService> {
  if (!servicePromise) {
    servicePromise = getDocumentRepository().then((repository) =>
      createContentService(repository, contentCodecs),
    );
  }
  return servicePromise;
}
