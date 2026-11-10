import type { DocumentType } from "@/lib/documents/types";
import styles from "./EditorSurface.module.css";

function WordSurface() {
  return (
    <div
      className={styles.wordFrame}
      data-testid="surface-word"
      role="img"
      aria-label="Read-only Word page preview"
    >
      <div className={styles.page}>
        <div className={styles.pageHeading} />
        <div className={styles.pageLine} />
        <div className={styles.pageLine} />
        <div className={`${styles.pageLine} ${styles.short}`} />
        <div className={styles.pageGap} />
        <div className={styles.pageLine} />
        <div className={styles.pageLine} />
        <div className={`${styles.pageLine} ${styles.medium}`} />
        <p className={styles.pageHint}>Your document will appear here.</p>
      </div>
    </div>
  );
}

const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const ROWS = Array.from({ length: 12 }, (_, index) => index + 1);

function ExcelSurface() {
  return (
    <div
      className={styles.sheetFrame}
      data-testid="surface-excel"
      role="img"
      aria-label="Read-only Excel grid preview"
    >
      <div className={styles.sheet}>
        <div className={`${styles.cell} ${styles.corner}`} />
        {COLUMNS.map((column) => (
          <div key={column} className={`${styles.cell} ${styles.columnHead}`}>
            {column}
          </div>
        ))}
        {ROWS.map((row) => (
          <div key={row} className={styles.sheetRow}>
            <div className={`${styles.cell} ${styles.rowHead}`}>{row}</div>
            {COLUMNS.map((column) => (
              <div
                key={`${column}${row}`}
                className={styles.cell}
                aria-hidden="true"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PowerPointSurface() {
  return (
    <div
      className={styles.slideFrame}
      data-testid="surface-powerpoint"
      role="img"
      aria-label="Read-only PowerPoint slide preview"
    >
      <aside className={styles.slideRail} aria-hidden="true">
        {[1, 2, 3].map((slide) => (
          <div
            key={slide}
            className={`${styles.slideThumb} ${
              slide === 1 ? styles.slideThumbActive : ""
            }`}
          >
            <span>{slide}</span>
          </div>
        ))}
      </aside>
      <div className={styles.slideCanvas} data-testid="slide-canvas">
        <div className={styles.slideTitle} />
        <div className={styles.slideLine} />
        <div className={`${styles.slideLine} ${styles.slideLineShort}`} />
        <p className={styles.pageHint}>Your slides will appear here.</p>
      </div>
    </div>
  );
}

function DrawingSurface() {
  return (
    <div
      className={styles.drawingFrame}
      data-testid="surface-drawing"
      role="img"
      aria-label="Read-only Drawing canvas preview"
    >
      <canvas
        className={styles.drawingCanvas}
        data-testid="drawing-canvas"
        width={900}
        height={520}
        aria-label="Drawing canvas"
      />
      <div className={styles.drawingPlaceholder} aria-hidden="true">
        <span className={styles.shapeCircle} />
        <span className={styles.shapeSquare} />
        <span className={styles.shapeLine} />
      </div>
      <p className={styles.drawingHint}>Your drawing will appear here.</p>
    </div>
  );
}

export function EditorSurface({ type }: { type: DocumentType }) {
  if (type === "word") {
    return <WordSurface />;
  }
  if (type === "excel") {
    return <ExcelSurface />;
  }
  if (type === "powerpoint") {
    return <PowerPointSurface />;
  }
  return <DrawingSurface />;
}
