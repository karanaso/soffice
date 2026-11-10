# Spec Delta

## Purpose

Gives users a slide deck editor with an ordered slide list, a canvas for text content, and saved deck content that survives reload.

## ADDED Requirements

### Requirement: Deck opens with a slide list and canvas

Opening a PowerPoint document SHALL show a slide list in deck order and a canvas for the selected slide. A deck with no saved content SHALL open with one empty slide selected and ready for editing.

#### Scenario: Open an existing deck

- **WHEN** a user opens a PowerPoint document with saved slides
- **THEN** the slide list shows every slide in order and the first slide is selected on the canvas

#### Scenario: Open a new deck

- **WHEN** a user opens a PowerPoint document with no saved content
- **THEN** the deck contains one empty slide and the canvas accepts text editing

### Requirement: Users can add and select slides

The editor SHALL let the user add a slide after the current slide and select any slide from the list. The selected slide SHALL be visually identifiable.

#### Scenario: Add a slide

- **WHEN** the user adds a slide while a slide is selected
- **THEN** a new empty slide is inserted after it, becomes selected, and appears in the slide list

#### Scenario: Select another slide

- **WHEN** the user selects a different slide in the list
- **THEN** the canvas shows that slide's content and the list marks it as selected

### Requirement: Users can delete and reorder slides

The editor SHALL let the user delete the selected slide and move slides earlier or later in the deck. A deck SHALL always keep at least one slide.

#### Scenario: Delete a slide

- **WHEN** the user deletes the selected slide while more than one slide exists
- **THEN** the slide is removed, the list updates, and an adjacent slide becomes selected

#### Scenario: Keep the last slide

- **WHEN** the deck has one slide and the user requests deletion
- **THEN** the slide is kept and the editor explains that a deck needs at least one slide

#### Scenario: Reorder slides

- **WHEN** the user moves the selected slide earlier or later
- **THEN** the slide list and slide numbering reflect the new order

### Requirement: Slides contain editable text boxes

A slide SHALL support text boxes with text, position, and size. Users SHALL be able to add a text box, edit its text in place, move it on the canvas, and delete it.

#### Scenario: Add and edit a text box

- **WHEN** the user adds a text box and types into it
- **THEN** the box shows the typed text on the selected slide

#### Scenario: Move a text box

- **WHEN** the user drags a text box to another position on the canvas
- **THEN** the box remains at the new position and does not overlap incorrectly after reload

#### Scenario: Delete a text box

- **WHEN** the user deletes a selected text box
- **THEN** the box and its text disappear from the slide

### Requirement: Deck content is restored

Slide order, text boxes, their text, and their positions SHALL be saved and restored so that reopening or reloading the document shows the same deck.

#### Scenario: Reload after editing

- **WHEN** the user edits slides and text boxes, then reloads the page
- **THEN** the same slides appear in the same order with the same text and positions

#### Scenario: Reopen from the library

- **WHEN** the user opens the document again from the library
- **THEN** the saved deck is shown with a slide selected on the canvas
