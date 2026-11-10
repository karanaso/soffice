# Spec Delta

## Purpose

Defines one persistence contract for the content of every document type so each editor loads, validates, saves, and reports the state of its work consistently on both database backends.

## ADDED Requirements

### Requirement: Content belongs to one document

The system SHALL store editor content against exactly one existing document and SHALL return the most recently saved content when that document is opened. A document whose content has never been saved SHALL load as the empty document for its type.

#### Scenario: First open of a new document

- **WHEN** a user opens a document that has no saved content
- **THEN** the editor loads an empty document for that type without an error

#### Scenario: Reopen a saved document

- **WHEN** a user opens a document whose content was saved earlier
- **THEN** the editor loads that saved content

#### Scenario: Content requested for a missing document

- **WHEN** content is requested for a document that does not exist
- **THEN** the system reports that the document was not found and returns no content

### Requirement: Saving replaces content atomically

A save SHALL replace the document's stored content as a single operation. If the save fails, the previously stored content SHALL remain unchanged and the error SHALL be reported to the editor.

#### Scenario: Save succeeds

- **WHEN** an editor saves changed content
- **THEN** the new content becomes the document's stored content and the save is reported as successful

#### Scenario: Save fails

- **WHEN** storage is unavailable during a save
- **THEN** the save reports an error, the previously stored content is unchanged, and the user's unsaved edits remain in the editor

### Requirement: Saving content updates the document's last-modified time

A successful content save SHALL update the document's last-modified time so the library orders the edited document as recently modified.

#### Scenario: Edited document moves to the top

- **WHEN** a user saves a change to a document and returns to the library
- **THEN** that document is listed above documents that were not edited

### Requirement: Edits are saved automatically

Editors SHALL save content without requiring the user to press a save button. A save SHALL occur after a short idle period following the last change and when the editor is closed or the page is left.

#### Scenario: Idle after an edit

- **WHEN** the user stops editing for the configured idle period
- **THEN** the editor saves the content automatically

#### Scenario: Leave the document

- **WHEN** the user navigates away from the document while there are unsaved changes
- **THEN** the editor attempts to save before leaving

### Requirement: Save status is visible

The document shell SHALL display whether the content is saved, has unsaved changes, is being saved, or failed to save. When a save fails, the shell SHALL offer a retry action without discarding the user's edits.

#### Scenario: Successful automatic save

- **WHEN** an automatic save is in progress and then succeeds
- **THEN** the shell shows a saving state followed by a saved state

#### Scenario: Failed save

- **WHEN** an automatic save fails
- **THEN** the shell shows a failed state with a retry action and keeps the edits in the editor

### Requirement: Concurrent edits do not silently overwrite each other

The system SHALL reject a save made against content that changed since it was loaded and SHALL report the conflict instead of overwriting the newer content.

#### Scenario: Stale save

- **WHEN** an editor saves content based on an older revision than the stored revision
- **THEN** the system rejects the save with a conflict outcome and leaves the stored content unchanged

#### Scenario: Resolve a conflict

- **WHEN** a save conflict is reported
- **THEN** the editor lets the user reload the latest stored content and does not discard their version without confirmation

### Requirement: Invalid content is rejected

The system SHALL validate content against the shape and limits of the document's type before storing it. Invalid or oversized content SHALL be rejected with an actionable error and SHALL NOT replace stored content.

#### Scenario: Wrong content shape

- **WHEN** a save supplies content that does not match the document's type
- **THEN** the system rejects the save, reports a validation error, and keeps the stored content unchanged

#### Scenario: Oversized content

- **WHEN** a save supplies content larger than the allowed size
- **THEN** the system rejects the save and reports the size limit

### Requirement: Content is deleted with its document

Deleting a document SHALL delete its stored content, and later requests for that content SHALL report the document as not found.

#### Scenario: Delete a document with content

- **WHEN** a user deletes a document that has saved content
- **THEN** both the document and its content are removed

#### Scenario: Content after deletion

- **WHEN** content is requested after its document was deleted
- **THEN** the system reports that the document was not found
