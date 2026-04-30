import { useState, useRef, useCallback, useEffect } from 'react';

const DEAD_ZONE_PX = 5;

/**
 * Drag-to-reorder hook using global window listeners for robustness.
 * Pointer Events for unified mouse + touch. Ghost coordinates are
 * viewport-relative (caller should render via portal or outside any
 * ancestor with backdrop-filter / transform).
 */
export function useDragReorder({ itemCount, onReorder }) {
  const [dragIndex, setDragIndex] = useState(-1);
  const [overIndex, setOverIndex] = useState(-1);
  const [ghost, setGhost] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const isDragging = dragIndex !== -1;

  // Mutable tracking state (no re-renders)
  const s = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    activated: false,
    dragIndex: -1,
    overIndex: -1,
    offsetX: 0,
    offsetY: 0,
    originalRects: [],
    itemWidth: 0,
  });

  // Latest props, accessible to stable handlers
  const propsRef = useRef({ onReorder, itemCount });
  propsRef.current = { onReorder, itemCount };

  const itemElsRef = useRef([]);
  const justDraggedRef = useRef(false);

  const setItemRef = useCallback((index, el) => {
    if (el) itemElsRef.current[index] = el;
  }, []);

  // ---- Stable global handlers (defined once via ref) ----
  const h = useRef(null);

  if (!h.current) {
    const removeListeners = () => {
      window.removeEventListener('pointermove', h.current.onMove);
      window.removeEventListener('pointerup', h.current.onUp);
      window.removeEventListener('pointercancel', h.current.onCancel);
      window.removeEventListener('blur', h.current.onBlur);
      window.removeEventListener('contextmenu', h.current.onCtx);
      document.removeEventListener('visibilitychange', h.current.onVis);
    };

    const cancel = () => {
      if (s.current.activated) {
        justDraggedRef.current = true;
        requestAnimationFrame(() => { justDraggedRef.current = false; });
      }
      s.current.pointerId = null;
      s.current.activated = false;
      s.current.dragIndex = -1;
      s.current.overIndex = -1;
      setDragIndex(-1);
      setOverIndex(-1);
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
      removeListeners();
    };

    const onMove = (e) => {
      const st = s.current;
      if (st.dragIndex === -1) return;

      // --- Dead zone check (pre-activation) ---
      if (!st.activated) {
        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;
        if (Math.abs(dx) < DEAD_ZONE_PX && Math.abs(dy) < DEAD_ZONE_PX) return;

        // Activate
        st.activated = true;
        const idx = st.dragIndex;

        st.originalRects = itemElsRef.current
          .slice(0, propsRef.current.itemCount)
          .map(el => el?.getBoundingClientRect() ?? null);

        const rect = st.originalRects[idx];
        if (!rect) { cancel(); return; }

        st.offsetX = e.clientX - rect.left;
        st.offsetY = e.clientY - rect.top;
        st.itemWidth = rect.width;
        st.overIndex = idx;

        setDragIndex(idx);
        setOverIndex(idx);
        setGhost({ x: e.clientX - st.offsetX, y: e.clientY - st.offsetY, width: rect.width, height: rect.height });

        document.body.style.userSelect = 'none';
        document.body.style.touchAction = 'none';
        return;
      }

      // --- Active drag: update ghost + overIndex ---
      setGhost({
        x: e.clientX - st.offsetX,
        y: e.clientY - st.offsetY,
        width: st.originalRects[st.dragIndex]?.width ?? 0,
        height: st.originalRects[st.dragIndex]?.height ?? 0,
      });

      const px = e.clientX;
      let newOver = st.dragIndex;
      for (let i = 0; i < st.originalRects.length; i++) {
        const r = st.originalRects[i];
        if (!r) continue;
        const mid = r.left + r.width / 2;
        if (i < st.dragIndex && px < mid) { newOver = i; break; }
        if (i > st.dragIndex && px > mid) { newOver = i; }
      }
      st.overIndex = newOver;
      setOverIndex(newOver);
    };

    const onUp = () => {
      const st = s.current;
      if (st.activated && st.dragIndex !== -1 && st.overIndex !== -1 && st.overIndex !== st.dragIndex) {
        propsRef.current.onReorder(st.dragIndex, st.overIndex);
      }
      cancel();
    };

    const onCancel = () => cancel();
    const onBlur = () => cancel();
    const onCtx = () => cancel();
    const onVis = () => { if (document.hidden) cancel(); };

    h.current = { cancel, onMove, onUp, onCancel, onBlur, onCtx, onVis, removeListeners };
  }

  // Cleanup on unmount
  useEffect(() => () => h.current.cancel(), []);

  // ---- Per-item pointerdown ----
  const handlePointerDown = useCallback((index, e) => {
    if (e.target.closest('button, select, input, textarea, a')) return;
    if (e.button !== 0) return;
    if (propsRef.current.itemCount < 2) return;
    if (s.current.activated) return; // already dragging

    s.current.pointerId = e.pointerId;
    s.current.startX = e.clientX;
    s.current.startY = e.clientY;
    s.current.activated = false;
    s.current.dragIndex = index;

    // Global listeners for tracking (robust: works even if pointer leaves element)
    window.addEventListener('pointermove', h.current.onMove);
    window.addEventListener('pointerup', h.current.onUp);
    window.addEventListener('pointercancel', h.current.onCancel);
    window.addEventListener('blur', h.current.onBlur);
    window.addEventListener('contextmenu', h.current.onCtx);
    document.addEventListener('visibilitychange', h.current.onVis);
  }, []);

  // ---- Prop getters ----
  const getItemStyle = useCallback((index) => {
    if (dragIndex === -1) return {};
    if (index === dragIndex) return { opacity: 0.25, pointerEvents: 'none' };

    const shiftPx = (s.current.itemWidth || 0) + 24;

    if (dragIndex < overIndex && index > dragIndex && index <= overIndex) {
      return { transform: `translateX(-${shiftPx}px)`, transition: 'transform 0.25s cubic-bezier(0.2,0,0,1)' };
    }
    if (dragIndex > overIndex && index >= overIndex && index < dragIndex) {
      return { transform: `translateX(${shiftPx}px)`, transition: 'transform 0.25s cubic-bezier(0.2,0,0,1)' };
    }
    return { transition: 'transform 0.25s cubic-bezier(0.2,0,0,1)' };
  }, [dragIndex, overIndex]);

  const getItemProps = useCallback((index) => ({
    onPointerDown: (e) => handlePointerDown(index, e),
  }), [handlePointerDown]);

  return { isDragging, dragIndex, overIndex, ghost, setItemRef, getItemStyle, getItemProps, justDraggedRef };
}
