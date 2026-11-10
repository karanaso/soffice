"use client";

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { EditorProps } from "@/app/components/editor-contract";
import {
  createId,
  createSlide,
  powerpointCodec,
  type Deck,
  type Slide,
  type TextBox,
} from "@/lib/features/powerpoint/content";
import styles from "./PowerPointEditor.module.css";

const TEXT_BOX_WIDTH = 0.42;
const TEXT_BOX_HEIGHT = 0.22;
const MIN_CANVAS_SIZE = 1;
const POSITION_EPSILON = 1e-9;

interface DragState {
  pointerId: number;
  boxId: string;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  boxWidth: number;
  boxHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  moved: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeInitialContent(input: unknown): Deck {
  if (input === null || input === undefined) {
    return powerpointCodec.empty();
  }
  return powerpointCodec.parse(input);
}

function slidePreview(slide: Slide): string {
  const text = slide.textBoxes
    .map((box) => box.text.replace(/\s+/g, " ").trim())
    .find((value) => value.length > 0);
  if (!text) {
    return "Empty slide";
  }
  return text.length > 32 ? `${text.slice(0, 32)}…` : text;
}

function replaceSlide(deck: Deck, slideId: string, nextSlide: Slide): Deck {
  return {
    slides: deck.slides.map((slide) =>
      slide.id === slideId ? nextSlide : slide,
    ),
  };
}

function replaceTextBox(
  deck: Deck,
  slideId: string,
  boxId: string,
  update: (box: TextBox) => TextBox,
): Deck {
  return {
    slides: deck.slides.map((slide) => {
      if (slide.id !== slideId) {
        return slide;
      }
      return {
        ...slide,
        textBoxes: slide.textBoxes.map((box) =>
          box.id === boxId ? update(box) : box,
        ),
      };
    }),
  };
}

function findTextBox(
  deck: Deck,
  slideId: string,
  boxId: string,
): TextBox | null {
  const slide = deck.slides.find((candidate) => candidate.id === slideId);
  return slide?.textBoxes.find((box) => box.id === boxId) ?? null;
}

/**
 * Slide deck editor.
 *
 * Props are the shared {@link EditorProps} contract: the host passes parsed
 * deck content once, and this component reports the complete deck through
 * `onChange` after every committed edit. It never fetches or renders save
 * status; autosave belongs to the shared host.
 */
export function PowerPointEditor({
  documentId,
  initialContent,
  onChange,
}: EditorProps) {
  const [deck, setDeck] = useState<Deck>(() =>
    normalizeInitialContent(initialContent),
  );
  const [selectedSlideId, setSelectedSlideId] = useState<string>(
    () => deck.slides[0].id,
  );
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [slideMessage, setSlideMessage] = useState<string | null>(null);
  const [draggingBoxId, setDraggingBoxId] = useState<string | null>(null);

  const deckRef = useRef(deck);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const applyDeck = useCallback(
    (next: Deck, commit = true) => {
      deckRef.current = next;
      setDeck(next);
      if (commit) {
        onChange(next);
      }
    },
    [onChange],
  );

  const selectedSlide =
    deck.slides.find((slide) => slide.id === selectedSlideId) ?? deck.slides[0];
  const selectedIndex = deck.slides.findIndex(
    (slide) => slide.id === selectedSlide.id,
  );
  const selectedBox =
    selectedSlide.textBoxes.find((box) => box.id === selectedBoxId) ?? null;

  function selectSlide(slideId: string): void {
    setSelectedSlideId(slideId);
    setSelectedBoxId(null);
    setSlideMessage(null);
  }

  function addSlide(): void {
    const currentSlides = deckRef.current.slides;
    const currentIndex = currentSlides.findIndex(
      (slide) => slide.id === selectedSlideId,
    );
    const insertAt =
      currentIndex < 0 ? currentSlides.length : currentIndex + 1;
    const nextSlide = createSlide();
    const slides = [...currentSlides];
    slides.splice(insertAt, 0, nextSlide);

    applyDeck({ slides });
    setSelectedSlideId(nextSlide.id);
    setSelectedBoxId(null);
    setSlideMessage(null);
  }

  function moveSelectedSlide(direction: -1 | 1): void {
    const slides = deckRef.current.slides;
    const index = slides.findIndex((slide) => slide.id === selectedSlideId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= slides.length) {
      return;
    }

    const reordered = [...slides];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    applyDeck({ slides: reordered });
    setSlideMessage(null);
  }

  function deleteSelectedSlide(): void {
    const slides = deckRef.current.slides;
    if (slides.length <= 1) {
      setSlideMessage(
        "A deck needs at least one slide. Add another slide before deleting this one.",
      );
      return;
    }

    const index = slides.findIndex((slide) => slide.id === selectedSlideId);
    const remaining = slides.filter((slide) => slide.id !== selectedSlideId);
    const nextSelected = remaining[Math.min(Math.max(index, 0), remaining.length - 1)];

    applyDeck({ slides: remaining });
    setSelectedSlideId(nextSelected.id);
    setSelectedBoxId(null);
    setSlideMessage(null);
  }

  function addTextBox(): void {
    const slide = selectedSlide;
    const offset = slide.textBoxes.length % 5;
    const x = clamp(0.08 + offset * 0.06, 0, 1 - TEXT_BOX_WIDTH);
    const y = clamp(0.12 + offset * 0.06, 0, 1 - TEXT_BOX_HEIGHT);
    const textBox: TextBox = {
      id: createId("textbox"),
      x,
      y,
      width: TEXT_BOX_WIDTH,
      height: TEXT_BOX_HEIGHT,
      text: "",
    };

    applyDeck(
      replaceSlide(deckRef.current, slide.id, {
        ...slide,
        textBoxes: [...slide.textBoxes, textBox],
      }),
    );
    setSelectedBoxId(textBox.id);
    setSlideMessage(null);
  }

  function deleteSelectedTextBox(): void {
    if (!selectedBoxId) {
      return;
    }
    const slide = deckRef.current.slides.find(
      (candidate) => candidate.id === selectedSlideId,
    );
    if (!slide) {
      return;
    }
    applyDeck(
      replaceSlide(deckRef.current, slide.id, {
        ...slide,
        textBoxes: slide.textBoxes.filter((box) => box.id !== selectedBoxId),
      }),
    );
    setSelectedBoxId(null);
  }

  function updateSelectedTextBoxText(
    event: ChangeEvent<HTMLTextAreaElement>,
  ): void {
    if (!selectedBoxId) {
      return;
    }
    const text = event.currentTarget.value;
    applyDeck(
      replaceTextBox(deckRef.current, selectedSlideId, selectedBoxId, (box) => ({
        ...box,
        text,
      })),
    );
  }

  function handleTextKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      setSelectedBoxId(null);
    }
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLElement>,
    box: TextBox,
  ): void {
    if (event.button !== 0) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    if (rect.width < MIN_CANVAS_SIZE || rect.height < MIN_CANVAS_SIZE) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      boxId: box.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: box.x,
      originY: box.y,
      boxWidth: box.width,
      boxHeight: box.height,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      moved: false,
    };
    setDraggingBoxId(box.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleBoxPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
    box: TextBox,
  ): void {
    const target = event.target as HTMLElement;
    if (target.closest("textarea, button")) {
      return;
    }
    setSelectedBoxId(box.id);
    beginDrag(event, box);
  }

  function handleDragHandlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    box: TextBox,
  ): void {
    event.stopPropagation();
    setSelectedBoxId(box.id);
    beginDrag(event, box);
  }

  function handleBoxPointerMove(event: ReactPointerEvent<HTMLElement>): void {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const dx = (event.clientX - drag.startClientX) / drag.canvasWidth;
    const dy = (event.clientY - drag.startClientY) / drag.canvasHeight;
    if (Math.abs(dx) > POSITION_EPSILON || Math.abs(dy) > POSITION_EPSILON) {
      drag.moved = true;
    }

    const current = findTextBox(
      deckRef.current,
      selectedSlideId,
      drag.boxId,
    );
    if (!current) {
      return;
    }

    const x = clamp(drag.originX + dx, 0, 1 - drag.boxWidth);
    const y = clamp(drag.originY + dy, 0, 1 - drag.boxHeight);
    if (
      Math.abs(current.x - x) < POSITION_EPSILON &&
      Math.abs(current.y - y) < POSITION_EPSILON
    ) {
      return;
    }

    applyDeck(
      replaceTextBox(deckRef.current, selectedSlideId, drag.boxId, (box) => ({
        ...box,
        x,
        y,
      })),
      false,
    );
    event.preventDefault();
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>): void {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    dragRef.current = null;
    setDraggingBoxId(null);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.moved) {
      onChange(deckRef.current);
    }
  }

  function handleCanvasClick(event: ReactMouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      setSelectedBoxId(null);
    }
  }

  return (
    <section
      className={styles.editor}
      data-testid="editor-powerpoint"
      data-document-id={documentId}
      aria-label="PowerPoint editor"
    >
      <div className={styles.toolbar} role="toolbar" aria-label="Slide controls">
        <div className={styles.toolbarGroup}>
          <button type="button" className="button" onClick={addSlide}>
            Add slide
          </button>
          <button
            type="button"
            className="button"
            disabled={selectedIndex <= 0}
            onClick={() => moveSelectedSlide(-1)}
          >
            Move earlier
          </button>
          <button
            type="button"
            className="button"
            disabled={selectedIndex >= deck.slides.length - 1}
            onClick={() => moveSelectedSlide(1)}
          >
            Move later
          </button>
          <button
            type="button"
            className="button button-danger"
            onClick={deleteSelectedSlide}
          >
            Delete slide
          </button>
        </div>
        <div className={styles.toolbarGroup}>
          <button type="button" className="button" onClick={addTextBox}>
            Add text box
          </button>
          <button
            type="button"
            className="button button-quiet"
            disabled={!selectedBox}
            onClick={deleteSelectedTextBox}
          >
            Delete text box
          </button>
        </div>
      </div>

      {slideMessage ? (
        <p
          className={styles.message}
          role="status"
          data-testid="slide-limit-message"
        >
          {slideMessage}
        </p>
      ) : null}

      <div className={styles.workspace}>
        <nav className={styles.rail} aria-label="Slides">
          <ol className={styles.slideList} data-testid="slide-list">
            {deck.slides.map((slide, index) => {
              const selected = slide.id === selectedSlide.id;
              return (
                <li
                  key={slide.id}
                  className={styles.slideItem}
                  data-testid="slide-item"
                  data-slide-id={slide.id}
                  data-slide-number={index + 1}
                >
                  <button
                    type="button"
                    className={`${styles.slideButton} ${
                      selected ? styles.slideButtonSelected : ""
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => selectSlide(slide.id)}
                  >
                    <span className={styles.slideIndex} aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className={styles.slidePreviewFrame} aria-hidden="true">
                      <span className={styles.slidePreview}>
                        {slidePreview(slide)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className={styles.stage}>
          <div className={styles.canvasHeader}>
            <h2 className={styles.canvasTitle}>
              Slide {selectedIndex + 1} of {deck.slides.length}
            </h2>
            <p className={styles.canvasMeta}>
              {selectedSlide.textBoxes.length === 1
                ? "1 text box"
                : `${selectedSlide.textBoxes.length} text boxes`}
            </p>
          </div>

          <div className={styles.canvasFrame}>
            <div
              ref={canvasRef}
              className={styles.canvas}
              data-testid="slide-canvas"
              role="region"
              aria-label={`Slide ${selectedIndex + 1} canvas`}
              onClick={handleCanvasClick}
            >
              {selectedSlide.textBoxes.length === 0 ? (
                <p className={styles.canvasHint}>
                  No text boxes yet. Use “Add text box” to start writing.
                </p>
              ) : null}

              {selectedSlide.textBoxes.map((box) => {
                const selected = box.id === selectedBoxId;
                return (
                  <div
                    key={box.id}
                    className={`${styles.textBox} ${
                      selected ? styles.textBoxSelected : ""
                    } ${draggingBoxId === box.id ? styles.textBoxDragging : ""}`}
                    style={{
                      left: `${box.x * 100}%`,
                      top: `${box.y * 100}%`,
                      width: `${box.width * 100}%`,
                      height: `${box.height * 100}%`,
                    }}
                    data-testid="slide-text-box"
                    data-box-id={box.id}
                    data-x={box.x}
                    data-y={box.y}
                    data-width={box.width}
                    data-height={box.height}
                    onPointerDown={(event) =>
                      handleBoxPointerDown(event, box)
                    }
                    onPointerMove={handleBoxPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                  >
                    {selected ? (
                      <>
                        <textarea
                          className={styles.textInput}
                          aria-label="Text box text"
                          value={box.text}
                          placeholder="Type text"
                          autoFocus
                          onChange={updateSelectedTextBoxText}
                          onKeyDown={handleTextKeyDown}
                        />
                        <button
                          type="button"
                          className={styles.dragHandle}
                          aria-label="Move text box"
                          data-testid="text-box-drag"
                          onPointerDown={(event) =>
                            handleDragHandlePointerDown(event, box)
                          }
                        >
                          <span aria-hidden="true">⠿</span>
                        </button>
                      </>
                    ) : (
                      <p
                        className={`${styles.textContent} ${
                          box.text ? "" : styles.emptyText
                        }`}
                      >
                        {box.text || "Empty text box"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
