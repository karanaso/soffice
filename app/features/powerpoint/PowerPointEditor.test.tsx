// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Deck, Slide, TextBox } from "@/lib/features/powerpoint/content";
import { PowerPointEditor } from "./PowerPointEditor";
import { PowerPointEditor as EntryPoint } from "./index";

function makeSlide(id: string, textBoxes: TextBox[] = []): Slide {
  return { id, textBoxes };
}

function makeBox(overrides: Partial<TextBox> = {}): TextBox {
  return {
    id: "box-1",
    x: 0.1,
    y: 0.1,
    width: 0.4,
    height: 0.2,
    text: "Hello",
    ...overrides,
  };
}

function makeDeck(...slides: Slide[]): Deck {
  return { slides };
}

function renderEditor(
  initialContent: unknown = makeDeck(makeSlide("slide-1")),
  onChange = vi.fn<(content: unknown) => void>(),
) {
  return {
    onChange,
    ...render(
      <PowerPointEditor
        documentId="deck-1"
        initialContent={initialContent}
        onChange={onChange}
      />,
    ),
  };
}

function lastDeck(onChange: ReturnType<typeof vi.fn>): Deck {
  return onChange.mock.calls.at(-1)?.[0] as Deck;
}

function canvas(): HTMLElement {
  return screen.getByTestId("slide-canvas");
}

function canvasRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("PowerPointEditor", () => {
  it("is exported from the feature entry point", () => {
    expect(EntryPoint).toBe(PowerPointEditor);
  });

  it("renders the slide list in order with the first slide selected", () => {
    const { onChange } = renderEditor(
      makeDeck(
        makeSlide("slide-1", [makeBox({ text: "Opening slide" })]),
        makeSlide("slide-2", [makeBox({ id: "box-2", text: "Closing slide" })]),
      ),
    );

    expect(screen.getByTestId("editor-powerpoint")).toHaveAttribute(
      "data-document-id",
      "deck-1",
    );
    expect(screen.getByTestId("editor-powerpoint")).toHaveAccessibleName(
      "PowerPoint editor",
    );

    const items = screen.getAllByTestId("slide-item");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("data-slide-number", "1");
    expect(items[1]).toHaveAttribute("data-slide-number", "2");
    expect(within(items[0]).getByText("Opening slide")).toBeInTheDocument();
    expect(within(items[1]).getByText("Closing slide")).toBeInTheDocument();
    expect(
      within(items[0]).getByRole("button", { name: "Go to slide 1" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("heading", { name: "Slide 1 of 2" }),
    ).toBeInTheDocument();
    expect(within(canvas()).getByText("Opening slide")).toBeInTheDocument();
    expect(within(canvas()).queryByText("Closing slide")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("mounts a new deck with one editable empty slide", async () => {
    renderEditor(null);

    expect(screen.getAllByTestId("slide-item")).toHaveLength(1);
    expect(
      within(canvas()).getByText(/No text boxes yet/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add text box" }));
    expect(
      within(canvas()).getByRole("textbox", { name: "Text box text" }),
    ).toBeInTheDocument();
  });

  it("adds a slide after the current slide and selects it", async () => {
    const { onChange } = renderEditor(
      makeDeck(
        makeSlide("slide-1", [makeBox({ text: "First" })]),
        makeSlide("slide-2", [makeBox({ id: "box-2", text: "Second" })]),
      ),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Go to slide 1" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Add slide" }));

    const next = lastDeck(onChange);
    expect(next.slides).toHaveLength(3);
    expect(next.slides[0].id).toBe("slide-1");
    expect(next.slides[2].id).toBe("slide-2");
    expect(next.slides[1].textBoxes).toEqual([]);
    expect(next.slides[1].id).not.toBe("slide-1");
    expect(next.slides[1].id).not.toBe("slide-2");

    const items = screen.getAllByTestId("slide-item");
    expect(items).toHaveLength(3);
    expect(within(items[1]).getByText("Empty slide")).toBeInTheDocument();
    expect(
      within(items[1]).getByRole("button", { name: "Go to slide 2" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("heading", { name: "Slide 2 of 3" }),
    ).toBeInTheDocument();
  });

  it("selects another slide and shows only its content", async () => {
    const { onChange } = renderEditor(
      makeDeck(
        makeSlide("slide-1", [makeBox({ text: "First slide" })]),
        makeSlide("slide-2", [makeBox({ id: "box-2", text: "Second slide" })]),
      ),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Go to slide 2" }),
    );

    expect(within(canvas()).getByText("Second slide")).toBeInTheDocument();
    expect(within(canvas()).queryByText("First slide")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Go to slide 2" }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Go to slide 1" }),
    ).not.toHaveAttribute("aria-current");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves the selected slide earlier and later with updated numbering", async () => {
    const { onChange } = renderEditor(
      makeDeck(
        makeSlide("slide-1", [makeBox({ text: "A" })]),
        makeSlide("slide-2", [makeBox({ id: "box-2", text: "B" })]),
        makeSlide("slide-3", [makeBox({ id: "box-3", text: "C" })]),
      ),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Go to slide 2" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Move earlier" }),
    );

    expect(lastDeck(onChange).slides.map((slide) => slide.id)).toEqual([
      "slide-2",
      "slide-1",
      "slide-3",
    ]);
    expect(
      screen.getAllByTestId("slide-item").map((item) => item.dataset.slideNumber),
    ).toEqual(["1", "2", "3"]);
    expect(
      within(screen.getAllByTestId("slide-item")[0]).getByText("B"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move earlier" }),
    ).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Move later" }));

    expect(lastDeck(onChange).slides.map((slide) => slide.id)).toEqual([
      "slide-1",
      "slide-2",
      "slide-3",
    ]);
    expect(
      within(screen.getAllByTestId("slide-item")[1]).getByText("B"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Move later" }),
    ).not.toBeDisabled();
  });

  it("deletes the selected slide and selects an adjacent slide", async () => {
    const { onChange } = renderEditor(
      makeDeck(
        makeSlide("slide-1", [makeBox({ text: "A" })]),
        makeSlide("slide-2", [makeBox({ id: "box-2", text: "B" })]),
        makeSlide("slide-3", [makeBox({ id: "box-3", text: "C" })]),
      ),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Go to slide 2" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Delete slide" }),
    );

    expect(lastDeck(onChange).slides.map((slide) => slide.id)).toEqual([
      "slide-1",
      "slide-3",
    ]);
    expect(screen.getAllByTestId("slide-item")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Go to slide 2" }),
    ).toHaveAttribute("aria-current", "true");
    expect(within(canvas()).getByText("C")).toBeInTheDocument();
  });

  it("keeps the last slide and explains the limit", async () => {
    const { onChange } = renderEditor(
      makeDeck(makeSlide("slide-1", [makeBox({ text: "Only slide" })])),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Delete slide" }),
    );

    expect(screen.getAllByTestId("slide-item")).toHaveLength(1);
    expect(within(canvas()).getByText("Only slide")).toBeInTheDocument();
    expect(screen.getByTestId("slide-limit-message")).toHaveTextContent(
      "A deck needs at least one slide",
    );
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Add slide" }));
    expect(screen.queryByTestId("slide-limit-message")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("slide-item")).toHaveLength(2);
  });

  it("adds a text box, edits it inline, and reports the typed text", async () => {
    const { onChange } = renderEditor(
      makeDeck(makeSlide("slide-1"), makeSlide("slide-2")),
    );

    await userEvent.click(screen.getByRole("button", { name: "Add text box" }));

    const input = within(canvas()).getByRole("textbox", {
      name: "Text box text",
    });
    expect(input).toHaveFocus();
    await userEvent.type(input, "Lesson title");

    expect(input).toHaveValue("Lesson title");
    const box = lastDeck(onChange).slides[0].textBoxes[0];
    expect(box.text).toBe("Lesson title");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1);
    expect(box.y + box.height).toBeLessThanOrEqual(1);

    fireEvent.keyDown(input, { key: "Escape" });
    expect(within(canvas()).getByText("Lesson title")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Go to slide 2" }),
    );
    expect(within(canvas()).queryByText("Lesson title")).not.toBeInTheDocument();
  });

  it("deletes the selected text box", async () => {
    renderEditor(
      makeDeck(
        makeSlide("slide-1", [makeBox({ text: "Remove this box" })]),
      ),
    );

    expect(
      screen.getByRole("button", { name: "Delete text box" }),
    ).toBeDisabled();
    await userEvent.click(within(canvas()).getByText("Remove this box"));
    expect(
      screen.getByRole("button", { name: "Delete text box" }),
    ).not.toBeDisabled();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete text box" }),
    );

    expect(
      within(canvas()).queryByText("Remove this box"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("slide-text-box")).not.toBeInTheDocument();
  });

  it("drags a text box with pointer movement and reports the fraction position", async () => {
    const { onChange } = renderEditor(
      makeDeck(
        makeSlide("slide-1", [
          makeBox({ text: "Drag me", x: 0.1, y: 0.1 }),
        ]),
      ),
    );

    vi.spyOn(canvas(), "getBoundingClientRect").mockReturnValue(
      canvasRect(800, 450),
    );
    await userEvent.click(within(canvas()).getByText("Drag me"));

    const handle = within(canvas()).getByRole("button", {
      name: "Move text box",
    });
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      clientX: 80,
      clientY: 45,
    });
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 320,
      clientY: 180,
    });
    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: 320,
      clientY: 180,
    });

    const box = lastDeck(onChange).slides[0].textBoxes[0];
    expect(box.x).toBeCloseTo(0.4);
    expect(box.y).toBeCloseTo(0.4);
    expect(within(canvas()).getByTestId("slide-text-box")).toHaveStyle({
      left: "40%",
      top: "40%",
    });
  });

  it("clamps dragging to the canvas bounds", async () => {
    const { onChange } = renderEditor(
      makeDeck(
        makeSlide("slide-1", [
          makeBox({ text: "Drag me", x: 0.1, y: 0.1, width: 0.4, height: 0.2 }),
        ]),
      ),
    );

    vi.spyOn(canvas(), "getBoundingClientRect").mockReturnValue(
      canvasRect(800, 450),
    );
    await userEvent.click(within(canvas()).getByText("Drag me"));

    const handle = within(canvas()).getByRole("button", {
      name: "Move text box",
    });
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      clientX: 80,
      clientY: 45,
    });
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 20_000,
      clientY: 20_000,
    });
    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: 20_000,
      clientY: 20_000,
    });

    const box = lastDeck(onChange).slides[0].textBoxes[0];
    expect(box.x).toBeCloseTo(0.6);
    expect(box.y).toBeCloseTo(0.8);
    expect(box.x + box.width).toBeCloseTo(1);
    expect(box.y + box.height).toBeCloseTo(1);
  });

  it("keeps percentage positions after remounting at a different canvas width", async () => {
    const { onChange, unmount } = renderEditor(
      makeDeck(
        makeSlide("slide-1", [
          makeBox({ text: "Resize me", x: 0.2, y: 0.2 }),
        ]),
      ),
    );

    vi.spyOn(canvas(), "getBoundingClientRect").mockReturnValue(
      canvasRect(800, 450),
    );
    await userEvent.click(within(canvas()).getByText("Resize me"));

    const handle = within(canvas()).getByRole("button", {
      name: "Move text box",
    });
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      clientX: 160,
      clientY: 90,
    });
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 400,
      clientY: 180,
    });
    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: 400,
      clientY: 180,
    });

    const saved = lastDeck(onChange);
    expect(saved.slides[0].textBoxes[0].x).toBeCloseTo(0.5);
    expect(saved.slides[0].textBoxes[0].y).toBeCloseTo(0.4);

    unmount();
    render(
      <PowerPointEditor
        documentId="deck-1"
        initialContent={saved}
        onChange={vi.fn()}
      />,
    );
    expect(within(canvas()).getByTestId("slide-text-box")).toHaveStyle({
      left: "50%",
      top: "40%",
    });
  });
});
