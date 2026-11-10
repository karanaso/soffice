export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NameConflictError extends Error {
  constructor(message = "A document with that name already exists.") {
    super(message);
    this.name = "NameConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Document not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}
