# Spec Delta

## Purpose

Gives users a spreadsheet grid for entering values and basic formulas, with reliable recalculation and saved workbook content.

## ADDED Requirements

### Requirement: Workbook grid is editable

Opening an Excel document SHALL show a grid of cells labelled by column letters and row numbers. Selecting a cell and typing SHALL open a cell editor; Enter SHALL commit the value and move down one cell, and Escape SHALL cancel the edit.

#### Scenario: Enter a value

- **WHEN** the user types into a selected cell and presses Enter
- **THEN** the value is stored in that cell and the selection moves to the cell below

#### Scenario: Cancel an edit

- **WHEN** the user presses Escape while editing a cell
- **THEN** the cell keeps its previous value

#### Scenario: Replace a cell value

- **WHEN** the user edits a cell that already has a value
- **THEN** the new value replaces the old value

### Requirement: Cells support navigation and selection

Users SHALL be able to move the active cell with arrow keys, Tab, and Shift+Tab, and SHALL be able to select a cell with a pointer. The active cell's address and raw contents SHALL be shown in a formula bar.

#### Scenario: Navigate with the keyboard

- **WHEN** the user presses an arrow key, Tab, or Shift+Tab
- **THEN** the active cell moves one cell in that direction and the formula bar shows the new cell's address and contents

#### Scenario: Select with the pointer

- **WHEN** the user clicks a cell
- **THEN** that cell becomes active and its contents appear in the formula bar

### Requirement: Formulas recalculate from cell references

A cell whose content starts with `=` SHALL be treated as a formula. Formulas SHALL support numbers, the operators `+`, `-`, `*`, and `/`, parentheses, cell references such as `A1`, ranges, and the `SUM` function. Changing a referenced cell SHALL recalculate every dependent formula.

#### Scenario: Calculate a formula

- **WHEN** the user enters `=A1+B1` and cells A1 and B1 contain numbers
- **THEN** the formula cell shows their sum

#### Scenario: Recalculate dependents

- **WHEN** a cell referenced by a formula changes value
- **THEN** the formula cell updates to the new result without a reload

#### Scenario: Sum a range

- **WHEN** the user enters `=SUM(A1:A3)` and those cells contain numbers
- **THEN** the formula cell shows the total of the three cells

### Requirement: Formula errors are shown in the cell

A formula that cannot be evaluated SHALL show a standard error value such as `#DIV/0!`, `#REF!`, or `#NAME?` in its cell. The formula text SHALL be preserved so the user can correct it, and an error SHALL NOT block saving the workbook.

#### Scenario: Divide by zero

- **WHEN** a formula divides by a cell containing zero
- **THEN** the formula cell shows `#DIV/0!` and the other cells keep their values

#### Scenario: Correct an invalid formula

- **WHEN** a cell shows a formula error and the user edits the formula to a valid expression
- **THEN** the cell shows the calculated result

### Requirement: Cell edits can be undone and redone

The Excel editor SHALL support undoing and redoing committed cell edits in the order they were made. A new committed edit after an undo SHALL discard the redo history.

#### Scenario: Undo a cell edit

- **WHEN** the user undoes after changing a cell
- **THEN** the cell returns to its previous content and dependent formulas recalculate

#### Scenario: Redo a cell edit

- **WHEN** the user redoes after an undo
- **THEN** the cell change is applied again

### Requirement: Workbook content is restored

Cell values, formulas, and the active selection SHALL be saved and restored so that reopening or reloading the document shows the same workbook.

#### Scenario: Reload after editing

- **WHEN** the user enters values and formulas, then reloads the page
- **THEN** the same cells show the same raw contents and calculated results

#### Scenario: Reopen from the library

- **WHEN** the user opens the document again from the library
- **THEN** the saved workbook grid is shown

### Requirement: The grid has a defined first-draft size

The first-draft workbook SHALL provide 26 columns (`A` to `Z`) and 100 rows (1 to 100). Content outside this range SHALL NOT be created.

#### Scenario: Reach the grid boundary

- **WHEN** the user navigates to column Z or row 100
- **THEN** the cell is usable and navigation does not move beyond the defined range
