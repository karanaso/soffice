# editor-shells Specification

## Purpose

Defines the file-bound workspace each document opens into, giving users a recognizable place for Word, Excel, PowerPoint, and Drawing content while editing tools are delivered in later changes.

## Requirements

### Requirement: Workspace matches the document type

Opening a document SHALL show a shell specific to its type: a page surface for Word, a grid surface for Excel, a slide-and-canvas surface for PowerPoint, and a drawing canvas for Drawing. Every shell SHALL display the document name, its type label, and a control to return to the Library.

#### Scenario: Open each document type
- **WHEN** a user opens a Word, Excel, PowerPoint, or Drawing document
- **THEN** the workspace shows the surface associated with that type and the document's current name

#### Scenario: Renamed document
- **WHEN** a document is renamed while its shell is open
- **THEN** the shell shows the new name without requiring a reload

#### Scenario: Return to the library
- **WHEN** the user activates the Library control from a shell
- **THEN** the dashboard is shown and the document remains in the library

### Requirement: Shell reports document loading state

A shell SHALL show a loading state while the document is being read and SHALL show a recoverable error state if the document cannot be read. The error state SHALL offer retry and a way back to the Library.

#### Scenario: Document is loading
- **WHEN** a shell is opened before the document has been read
- **THEN** it shows a loading indicator in place of the document surface

#### Scenario: Document read fails
- **WHEN** reading the document from storage fails
- **THEN** the shell shows an error with retry and Library actions and does not show a blank editable surface

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
