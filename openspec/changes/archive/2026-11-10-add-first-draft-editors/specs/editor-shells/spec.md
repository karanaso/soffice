# Spec Delta

## REMOVED Requirements

### Requirement: Shells are explicitly read-only placeholders

**Reason**: The first-draft editors replace read-only placeholders with editable surfaces, so documents are no longer presented as read-only.

**Migration**: Open a document and edit it in the hosted editor; content is saved automatically and the shell shows save status. No user action is required.

## ADDED Requirements

### Requirement: Shells host an editable editor

A document shell SHALL host the editor for its document type in place of a placeholder and SHALL NOT describe the document as read-only. The shell SHALL show the document's save state as saved, unsaved, saving, or save failed while keeping the document name, type, and Library navigation available.

#### Scenario: Open an editable document

- **WHEN** a user opens a Word, Excel, PowerPoint, or Drawing document
- **THEN** the shell shows the editor for that type with its editing controls and no read-only notice

#### Scenario: Show save progress

- **WHEN** an editor saves a change
- **THEN** the shell shows a saving state and then a saved state

#### Scenario: Show a failed save

- **WHEN** an editor cannot save a change
- **THEN** the shell shows a save-failed state with a retry action and keeps the user's edits in the editor
