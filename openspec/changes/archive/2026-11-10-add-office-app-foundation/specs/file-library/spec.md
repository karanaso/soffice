# Spec Delta

## Purpose

Gives every user a single dashboard where they can see the school's documents and create, rename, open, or delete them without leaving the app.

## ADDED Requirements

### Requirement: Dashboard lists all documents

The system SHALL show a dashboard listing every stored document with its name, document type, and last-modified time. Documents SHALL be ordered by last-modified time, newest first, and each entry SHALL show a visible type label (Word, Excel, PowerPoint, or Drawing).

#### Scenario: Documents are present
- **WHEN** a user opens the dashboard and documents exist
- **THEN** the system shows one row or card per document with its name, type label, and last-modified time, newest first

#### Scenario: Dashboard is empty
- **WHEN** a user opens the dashboard and no documents exist
- **THEN** the system shows an empty state explaining that no documents exist and offering actions to create one

#### Scenario: Documents cannot be loaded
- **WHEN** the document list cannot be read from storage
- **THEN** the system shows an error state with a retry action instead of an empty list

### Requirement: Create a document

The system SHALL let a user create a document by choosing one of the four document types and entering a name. A successful creation SHALL persist the document, add it to the dashboard, and open it in the matching workspace tab.

#### Scenario: Create a named document
- **WHEN** the user chooses a type, enters a valid name, and confirms creation
- **THEN** the document is stored, appears at the top of the dashboard, and opens in the matching workspace tab

#### Scenario: Create with a blank name
- **WHEN** the user confirms creation without entering a name
- **THEN** the system creates the document with a generated default name based on its type and shows that name on the dashboard

#### Scenario: Creation fails
- **WHEN** storage rejects the new document
- **THEN** the system keeps the creation dialog open, shows an actionable error, and does not add a document to the dashboard

### Requirement: Rename a document

The system SHALL let a user rename an existing document without changing its type, identifier, or content. Names SHALL be trimmed, between 1 and 120 characters, and unique within the library regardless of letter case.

#### Scenario: Rename succeeds
- **WHEN** the user submits a new valid name for an existing document
- **THEN** the system persists the new name and shows it on the dashboard and in any open workspace for that document

#### Scenario: Rename to an existing name
- **WHEN** the user submits a name that matches another document regardless of case
- **THEN** the system rejects the rename, keeps the previous name, and explains that the name is already in use

#### Scenario: Rename to an invalid name
- **WHEN** the user submits a name that is empty after trimming or longer than 120 characters
- **THEN** the system rejects the rename and shows the allowed name length

### Requirement: Delete a document

The system SHALL let a user delete a document after an explicit confirmation that names the document. A confirmed deletion SHALL remove the document from the dashboard and close it if it is open in a workspace.

#### Scenario: Confirm deletion
- **WHEN** the user confirms deletion of a document
- **THEN** the document is removed from storage and no longer appears on the dashboard

#### Scenario: Cancel deletion
- **WHEN** the user dismisses the confirmation without confirming
- **THEN** the document remains unchanged on the dashboard

#### Scenario: Delete the document open in a workspace
- **WHEN** the user confirms deletion of the document currently open in a workspace
- **THEN** the workspace closes and the user is returned to the dashboard

### Requirement: Open a document from the dashboard

The system SHALL open a selected document in the workspace matching its type and SHALL expose a stable address for each document so the workspace can be reloaded or bookmarked.

#### Scenario: Open a document
- **WHEN** the user selects a document on the dashboard
- **THEN** the matching workspace tab becomes active and shows that document

#### Scenario: Reload an open document
- **WHEN** the user reloads the browser while a document workspace is open
- **THEN** the same document and workspace tab are restored

#### Scenario: Document no longer exists
- **WHEN** a document address is opened but the document has been deleted
- **THEN** the system shows a not-found state with a link back to the dashboard
