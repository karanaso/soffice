# Spec Delta

## Purpose

Defines the file-bound workspace each document opens into, giving users a recognizable place for Word, Excel, PowerPoint, and Drawing content while editing tools are delivered in later changes.

## ADDED Requirements

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

### Requirement: Shells are explicitly read-only placeholders

A document shell SHALL show a clear read-only notice stating that editing tools for that type are not available in this release. The shell SHALL NOT accept edits to document content and SHALL NOT persist document content.

#### Scenario: View a document shell
- **WHEN** a user opens any document
- **THEN** the shell displays a read-only notice naming the document type and offers no control that saves document content

#### Scenario: Attempt to modify content
- **WHEN** a user interacts with the placeholder surface
- **THEN** the document content does not change and no content is written to storage

### Requirement: Shell reports document loading state

A shell SHALL show a loading state while the document is being read and SHALL show a recoverable error state if the document cannot be read. The error state SHALL offer retry and a way back to the Library.

#### Scenario: Document is loading
- **WHEN** a shell is opened before the document has been read
- **THEN** it shows a loading indicator in place of the document surface

#### Scenario: Document read fails
- **WHEN** reading the document from storage fails
- **THEN** the shell shows an error with retry and Library actions and does not show a blank editable surface
