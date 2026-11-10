# Spec Delta

## Purpose

Provides the persistent shell that moves a user between the file dashboard and the four document workspaces, keeping the active document and tab understandable at all times.

## ADDED Requirements

### Requirement: Persistent tab navigation

The system SHALL present the same primary navigation on every screen: a Library tab plus Word, Excel, PowerPoint, and Drawing tabs. The navigation SHALL identify the active tab both visually and in the page title, and SHALL remain usable on screens from 360px wide upward.

#### Scenario: Navigate between tabs
- **WHEN** the user selects a tab other than the active one
- **THEN** the selected tab becomes active, its content is shown, and the previous tab is no longer marked active

#### Scenario: Return to the Library tab
- **WHEN** the user selects the Library tab from any workspace
- **THEN** the dashboard with the document list is shown

#### Scenario: Narrow screen
- **WHEN** the viewport is 360px wide
- **THEN** every tab remains reachable and the active tab is still identifiable

### Requirement: Each workspace tab holds one active document

Each of the four workspace tabs SHALL show at most one active document at a time. Opening a document of a type SHALL make that document active in the corresponding tab, and switching away from and back to the tab SHALL show the same document.

#### Scenario: Open a second document of the same type
- **WHEN** the user opens a document whose type already has an active document in its workspace tab
- **THEN** the newly opened document becomes active in that tab and the previously active document is no longer shown there

#### Scenario: Switch tabs and return
- **WHEN** the user switches from a workspace tab to another tab and then back
- **THEN** the workspace tab still shows the document that was active before the switch

### Requirement: Workspace tabs have an empty state

A workspace tab without an active document SHALL show an empty state with a create action for that document type and a list of the most recently modified documents of that type. Selecting a recent document SHALL activate it in the tab.

#### Scenario: Open an unused workspace tab
- **WHEN** the user selects a workspace tab that has no active document
- **THEN** the tab shows a create action for that type and recent documents of that type

#### Scenario: No documents of that type
- **WHEN** a workspace tab has no active document and no stored documents of its type
- **THEN** the tab offers the create action and explains that no documents of this type exist yet

#### Scenario: Create from a workspace tab
- **WHEN** the user creates a document from a workspace tab
- **THEN** the new document is persisted and becomes the active document in that tab

### Requirement: Address reflects the active workspace

The browser address SHALL identify the active tab and, when present, the active document. Loading that address directly SHALL restore the same tab and document, and an address for a document type mismatch SHALL show the document in its correct workspace tab.

#### Scenario: Load a workspace address
- **WHEN** the user loads an address that identifies a document in the Word workspace
- **THEN** the Word tab is active and shows that document

#### Scenario: Address type does not match the document
- **WHEN** the user loads an address whose tab and document type disagree
- **THEN** the system shows the document in the workspace tab for the document's actual type and updates the address to match
