export class ContentValidationError extends Error {
  constructor(message = "The document content is not valid for this document type.") {
    super(message);
    this.name = "ContentValidationError";
  }
}

export class ContentConflictError extends Error {
  constructor(
    message = "This document changed elsewhere. Reload the latest version before saving again.",
  ) {
    super(message);
    this.name = "ContentConflictError";
  }
}

export class ContentTooLargeError extends Error {
  constructor(message = "Document content must be 1 MiB or smaller.") {
    super(message);
    this.name = "ContentTooLargeError";
  }
}
