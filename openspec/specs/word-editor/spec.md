# word-editor Specification

## Purpose

Gives users a page-based rich-text editor for Word documents, with supported formatting and saved content that survives reload.

## Requirements

### Requirement: Word documents open in an editable page

Opening a Word document SHALL show its saved content on an editable page with a visible text caret. A Word document with no saved content SHALL show an empty editable page ready for typing.

#### Scenario: Open a Word document with content

- **WHEN** a user opens a Word document that has saved text and formatting
- **THEN** the page shows that content and accepts text edits

#### Scenario: Open an empty Word document

- **WHEN** a user opens a Word document with no saved content
- **THEN** the page is empty and editable, with the caret available for typing

### Requirement: Text editing supports paragraphs and line breaks

Users SHALL be able to type, select, replace, and delete text. Enter SHALL create a new paragraph and Shift+Enter SHALL insert a line break within the current paragraph.

#### Scenario: Type and replace text

- **WHEN** the user selects existing text and types replacement text
- **THEN** the selected text is replaced and the surrounding content is unchanged

#### Scenario: Add a paragraph

- **WHEN** the user presses Enter while editing
- **THEN** a new paragraph starts below the current one

#### Scenario: Add a line break

- **WHEN** the user presses Shift+Enter while editing
- **THEN** the cursor moves to a new line within the same paragraph

### Requirement: Users can apply basic rich-text formatting

The Word editor SHALL support bold, italic, underline, heading levels, bulleted lists, and numbered lists. A format command SHALL apply to the current selection or, when nothing is selected, to subsequently typed text.

#### Scenario: Format a selection

- **WHEN** the user selects text and activates bold, italic, or underline
- **THEN** the selected text shows that formatting and the change is saved with the document

#### Scenario: Apply a heading

- **WHEN** the user applies a heading level to the current paragraph
- **THEN** that paragraph is displayed at the chosen heading level and remains editable

#### Scenario: Create a list

- **WHEN** the user activates the bulleted or numbered list command on a paragraph
- **THEN** the paragraph becomes a list item of that type

### Requirement: Undo and redo restore previous edits

The Word editor SHALL support undoing and redoing text and formatting changes in the order they were made. A new edit after an undo SHALL discard the redo history.

#### Scenario: Undo an edit

- **WHEN** the user undoes after typing or formatting
- **THEN** the document returns to its state before that change

#### Scenario: Redo an undone edit

- **WHEN** the user redoes after an undo
- **THEN** the undone change is applied again

#### Scenario: New edit clears redo

- **WHEN** the user makes a new edit after undoing
- **THEN** the redo action is no longer available

### Requirement: Word content is restored with its formatting

The text and supported formatting of a Word document SHALL be saved and restored, so reopening or reloading the document shows the same content and formatting.

#### Scenario: Reload after editing

- **WHEN** the user edits and formats a Word document, then reloads the page
- **THEN** the document shows the same text, paragraphs, lists, and formatting

#### Scenario: Reopen from the library

- **WHEN** the user opens the document again from the library
- **THEN** the saved Word content is shown in the editable page

### Requirement: Unsupported pasted formatting is not preserved

Content pasted from outside the editor SHALL be reduced to the supported Word content model so that unsupported styles do not corrupt the saved document.

#### Scenario: Paste rich text from another application

- **WHEN** the user pastes text carrying unsupported fonts, colors, or layout
- **THEN** the text is inserted as plain paragraphs and only supported formatting is kept
