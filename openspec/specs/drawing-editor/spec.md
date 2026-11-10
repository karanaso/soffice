# drawing-editor Specification

## Purpose

Gives users a drawing canvas with freehand and eraser tools, simple stroke styling, undo and redo, and saved drawings that survive reload.

## Requirements

### Requirement: Canvas accepts freehand drawing

The Drawing editor SHALL provide a canvas that creates a continuous stroke while the user presses and moves a pointer, and ends the stroke when the pointer is released. Touch and mouse input SHALL behave the same way.

#### Scenario: Draw a stroke

- **WHEN** the user presses the pointer on the canvas, moves it, and releases
- **THEN** a continuous stroke following the pointer path is added to the drawing

#### Scenario: Draw with touch

- **WHEN** the user draws with a finger or stylus on a touch screen
- **THEN** the stroke is created at the touched points

#### Scenario: Click without moving

- **WHEN** the user presses and releases the pointer without moving
- **THEN** a visible dot is added at that point

### Requirement: Pen and eraser tools

The editor SHALL offer a pen tool and an eraser tool. The pen SHALL add strokes, and the eraser SHALL remove complete strokes it touches.

#### Scenario: Draw with the pen

- **WHEN** the pen tool is active and the user draws
- **THEN** new strokes are added to the drawing

#### Scenario: Erase a stroke

- **WHEN** the eraser tool is active and the user moves it across an existing stroke
- **THEN** that stroke is removed and the rest of the drawing is unchanged

### Requirement: Stroke color and width are selectable

The editor SHALL offer a set of colors and stroke widths. The selected values SHALL apply to strokes drawn afterwards and SHALL be stored with each stroke.

#### Scenario: Choose a color

- **WHEN** the user selects a color and then draws
- **THEN** the new stroke is drawn and stored in that color

#### Scenario: Choose a width

- **WHEN** the user selects a stroke width and then draws
- **THEN** the new stroke is drawn and stored with that width

### Requirement: Undo and redo drawing changes

The editor SHALL support undoing and redoing added strokes and eraser actions in the order they were made. A new drawing action after an undo SHALL discard the redo history.

#### Scenario: Undo a stroke

- **WHEN** the user undoes after drawing
- **THEN** the most recent stroke disappears from the canvas

#### Scenario: Redo an erased stroke

- **WHEN** the user undoes an eraser action and then redoes it
- **THEN** the erased stroke is removed again

### Requirement: Drawing content is restored

Strokes, their colors, widths, and positions SHALL be saved and restored so that reopening or reloading the document shows the same drawing. The drawing SHALL keep its proportions when the canvas is displayed at a different size.

#### Scenario: Reload after drawing

- **WHEN** the user draws, then reloads the page
- **THEN** the same strokes reappear at the same relative positions with the same colors and widths

#### Scenario: Reopen from the library

- **WHEN** the user opens the document again from the library
- **THEN** the saved drawing is shown on the canvas

### Requirement: The canvas can be cleared

The editor SHALL offer a clear action that removes every stroke after an explicit confirmation. Clearing SHALL be undoable until another drawing action is made.

#### Scenario: Clear the drawing

- **WHEN** the user confirms clearing the canvas
- **THEN** the canvas becomes empty and the clear action can be undone

#### Scenario: Cancel clearing

- **WHEN** the user dismisses the clear confirmation
- **THEN** the drawing is unchanged
