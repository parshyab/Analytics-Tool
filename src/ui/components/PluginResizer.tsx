import { useCallback, useEffect, useRef, useState } from "react";
import { clampPluginUiSize, PLUGIN_UI_SIZE } from "../../pluginUiSize";
import { postMessage } from "../hooks";

export function PluginResizer() {
  const [sizeLabel, setSizeLabel] = useState<string | null>(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const raf = useRef<number | null>(null);
  const pending = useRef<{ width: number; height: number } | null>(null);

  const flushResize = useCallback(() => {
    if (!pending.current) return;
    const next = clampPluginUiSize(pending.current.width, pending.current.height);
    pending.current = null;
    postMessage({ type: "RESIZE", width: next.width, height: next.height });
    setSizeLabel(`${next.width} × ${next.height}`);
  }, []);

  const scheduleResize = useCallback(
    (width: number, height: number) => {
      pending.current = { width, height };
      if (raf.current != null) return;
      raf.current = window.requestAnimationFrame(() => {
        raf.current = null;
        flushResize();
      });
    },
    [flushResize]
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      scheduleResize(start.current.width + dx, start.current.height + dy);
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove("plugin-resizing");
      flushResize();
      window.setTimeout(() => setSizeLabel(null), 1200);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (raf.current != null) window.cancelAnimationFrame(raf.current);
    };
  }, [flushResize, scheduleResize]);

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    dragging.current = true;
    start.current = {
      x: event.clientX,
      y: event.clientY,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    document.body.classList.add("plugin-resizing");
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <div className="plugin-resizer" aria-hidden={false}>
      {sizeLabel && <span className="plugin-resizer-label">{sizeLabel}</span>}
      <button
        type="button"
        className="plugin-resizer-handle"
        aria-label={`Resize plugin window (${PLUGIN_UI_SIZE.minWidth}–${PLUGIN_UI_SIZE.maxWidth}px wide)`}
        title="Drag to resize"
        onPointerDown={onPointerDown}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M13 1v12H1M13 5v8H5M13 9v4H9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
