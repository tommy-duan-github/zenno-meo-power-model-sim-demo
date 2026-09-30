'use client';

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

type PanelWidths = { input: number; view: number };
type Divider = 'input' | 'view';

const DEFAULT_WIDTHS: PanelWidths = { input: 318, view: 338 };
const MIN_WIDTHS = { input: 220, results: 320, view: 230 };
const DIVIDER_WIDTH = 12;
const STORAGE_KEY = 'meo-panel-widths';

function fitWidths(widths: PanelWidths, available: number): PanelWidths {
  if (!available) return widths;
  const outerSpace = Math.max(
    MIN_WIDTHS.input + MIN_WIDTHS.view,
    available - 2 * DIVIDER_WIDTH - MIN_WIDTHS.results,
  );
  const input = Math.max(MIN_WIDTHS.input, widths.input);
  const view = Math.max(MIN_WIDTHS.view, widths.view);
  const extraInput = input - MIN_WIDTHS.input;
  const extraView = view - MIN_WIDTHS.view;
  const extraSpace = outerSpace - MIN_WIDTHS.input - MIN_WIDTHS.view;
  const scale = Math.min(1, extraSpace / (extraInput + extraView || 1));
  return {
    input: Math.round(MIN_WIDTHS.input + extraInput * scale),
    view: Math.round(MIN_WIDTHS.view + extraView * scale),
  };
}

export default function ResizablePanels({ input, results, view }: { input: ReactNode; results: ReactNode; view: ReactNode }) {
  const [widths, setWidths] = useState<PanelWidths>(DEFAULT_WIDTHS);
  const [loaded, setLoaded] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as PanelWidths | null;
      if (saved && Number.isFinite(saved.input) && Number.isFinite(saved.view)) {
        setWidths({ input: Math.max(MIN_WIDTHS.input, saved.input), view: Math.max(MIN_WIDTHS.view, saved.view) });
      }
    } catch {}
    setLoaded(true);
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new ResizeObserver(() => setGridWidth(grid.getBoundingClientRect().width));
    observer.observe(grid);
    setGridWidth(grid.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(widths)); } catch {}
  }, [widths, loaded]);

  const fitted = fitWidths(widths, gridWidth);
  const gridStyle = {
    '--input-width': `${fitted.input}px`,
    '--view-width': `${fitted.view}px`,
  } as CSSProperties;

  function moveDivider(divider: Divider, clientX: number) {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    setWidths(current => {
      const actual = fitWidths(current, rect.width);
      const maxInput = rect.width - 2 * DIVIDER_WIDTH - actual.view - MIN_WIDTHS.results;
      const maxView = rect.width - 2 * DIVIDER_WIDTH - actual.input - MIN_WIDTHS.results;
      return divider === 'input'
        ? { input: Math.max(MIN_WIDTHS.input, Math.min(maxInput, Math.round(clientX - rect.left))), view: actual.view }
        : { input: actual.input, view: Math.max(MIN_WIDTHS.view, Math.min(maxView, Math.round(rect.right - clientX))) };
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>, divider: Divider) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) moveDivider(divider, event.clientX);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>, divider: Divider) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    const step = (event.shiftKey ? 48 : 16) * (event.key === 'ArrowRight' ? 1 : -1);
    const currentX = divider === 'input'
      ? rect.left + fitWidths(widths, rect.width).input
      : rect.right - fitWidths(widths, rect.width).view;
    moveDivider(divider, currentX + step);
  }

  function divider(kind: Divider) {
    const isInput = kind === 'input';
    return <div
      className="panel-divider"
      role="separator"
      aria-label={isInput ? 'Resize parameter input and simulation results' : 'Resize simulation results and visualisation'}
      aria-orientation="vertical"
      aria-controls={isInput ? 'input-panel results-panel' : 'results-panel visualisation-panel'}
      aria-valuemin={isInput ? MIN_WIDTHS.input : MIN_WIDTHS.view}
      aria-valuemax={Math.max(isInput ? MIN_WIDTHS.input : MIN_WIDTHS.view, gridWidth - 2 * DIVIDER_WIDTH - (isInput ? fitted.view : fitted.input) - MIN_WIDTHS.results)}
      aria-valuenow={isInput ? fitted.input : fitted.view}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={event => onPointerMove(event, kind)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onLostPointerCapture={() => setDragging(false)}
      onKeyDown={event => onKeyDown(event, kind)}
    />;
  }

  return <div ref={gridRef} className={`sim-grid${dragging ? ' is-resizing' : ''}`} style={gridStyle}>
    {input}{divider('input')}{results}{divider('view')}{view}
  </div>;
}
