import { useState, useRef, useCallback, useEffect } from 'react';

const DEAD_ZONE_PX = 5;

/**
 * Custom hook for drag-to-reorder in a horizontal list.
 * Uses Pointer Events for unified mouse + touch support.
 *
 * @param {Object} opts
 * @param {number} opts.itemCount - Number of draggable items
 * @param {Function} opts.onReorder - (fromIndex, toIndex) => void
 * @returns drag state and prop-getters for items
 */
export function useDragReorder({ itemCount, onReorder }) {
  const [dragIndex, setDragIndex] = useState(-1);
  const [overIndex, setOverIndex] = useState(-1);
  const [ghost, setGhost] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const isDragging = dragIndex !== -1;

  // Mutable ref for high-frequency tracking without re-renders
  const internals = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    activated: false,
    dragIndex: -1,
    offsetX: 0,
    offsetY: 0,
    originalRects: [],  // captured on drag start
    itemWidth: 0,       // width of dragged item (for shift calc)
  });

  // Store item DOM refs
  const itemElsRef = useRef([]);

  const setItemRef = useCallback((index, el) => {
    if (el) itemElsRef.current[index] = el;
  }, []);

  // ---- Pointer Handlers ----

  const handlePointerDown = useCallback((index, e) => {
    // Don't drag from interactive children
    if (e.target.closest('button, select, input, textarea, a')) return;
    if (e.button !== 0) return;       // primary button only
    if (itemCount < 2) return;        // nothing to reorder

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    internals.current.pointerId = e.pointerId;
    internals.current.startX = e.clientX;
    internals.current.startY = e.clientY;
    internals.current.activated = false;
    internals.current.dragIndex = index;
  }, [itemCount]);

  const handlePointerMove = useCallback((index, e) => {
    const d = internals.current;
    if (d.pointerId !== e.pointerId || d.dragIndex !== index) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.activated) {
      if (Math.abs(dx) < DEAD_ZONE_PX && Math.abs(dy) < DEAD_ZONE_PX) return;

      // ---- Activate drag ----
      d.activated = true;

      // Snapshot all item rects before anything moves
      d.originalRects = itemElsRef.current
        .slice(0, itemCount)
        .map(el => el?.getBoundingClientRect() ?? null);

      const draggedRect = d.originalRects[index];
      if (!draggedRect) return;

      d.offsetX = e.clientX - draggedRect.left;
      d.offsetY = e.clientY - draggedRect.top;
      d.itemWidth = draggedRect.width;

      setDragIndex(index);
      setOverIndex(index);
      setGhost({
        x: e.clientX - d.offsetX,
        y: e.clientY - d.offsetY,
        width: draggedRect.width,
        height: draggedRect.height,
      });

      // Prevent scrolling & text selection during drag
      document.body.style.userSelect = 'none';
      document.body.style.touchAction = 'none';
      return;
    }

    // ---- Dragging: update ghost + calculate overIndex ----
    setGhost({
      x: e.clientX - d.offsetX,
      y: e.clientY - d.offsetY,
      width: d.originalRects[index]?.width ?? 0,
      height: d.originalRects[index]?.height ?? 0,
    });

    // Determine drop target by comparing pointer X to original midpoints
    const pointerX = e.clientX;
    let newOver = d.dragIndex;

    for (let i = 0; i < d.originalRects.length; i++) {
      const rect = d.originalRects[i];
      if (!rect) continue;
      const mid = rect.left + rect.width / 2;

      if (i < d.dragIndex && pointerX < mid) {
        newOver = i;
        break;
      }
      if (i > d.dragIndex && pointerX > mid) {
        newOver = i;
      }
    }

    setOverIndex(newOver);
  }, [itemCount]);

  const handlePointerUp = useCallback((index, e) => {
    const d = internals.current;
    if (d.pointerId !== e.pointerId || d.dragIndex !== index) return;

    if (d.activated && d.dragIndex !== -1) {
      // Commit the reorder
      setOverIndex(currentOver => {
        if (currentOver !== -1 && currentOver !== d.dragIndex) {
          onReorder(d.dragIndex, currentOver);
        }
        return -1;
      });
    }

    // Reset everything
    d.pointerId = null;
    d.activated = false;
    d.dragIndex = -1;
    setDragIndex(-1);
    setOverIndex(-1);

    document.body.style.userSelect = '';
    document.body.style.touchAction = '';
  }, [onReorder]);

  const handlePointerCancel = useCallback((index, e) => {
    const d = internals.current;
    if (d.pointerId !== e.pointerId) return;

    d.pointerId = null;
    d.activated = false;
    d.dragIndex = -1;
    setDragIndex(-1);
    setOverIndex(-1);
    document.body.style.userSelect = '';
    document.body.style.touchAction = '';
  }, []);

  // ---- Prop getters ----

  /**
   * Returns the inline style for an item at `index` during drag.
   * Shifts items to visually "make space" for the drop.
   */
  const getItemStyle = useCallback((index) => {
    if (dragIndex === -1) return {};

    // The dragged item becomes a placeholder
    if (index === dragIndex) {
      return {
        opacity: 0.25,
        pointerEvents: 'none',
      };
    }

    // Shift items between dragIndex and overIndex
    const d = internals.current;
    const shiftPx = (d.itemWidth || 0) + 24; // item width + gap (1.5rem ≈ 24px)

    if (dragIndex < overIndex) {
      // Dragging right: items between (dragIndex, overIndex] shift left
      if (index > dragIndex && index <= overIndex) {
        return { transform: `translateX(-${shiftPx}px)`, transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' };
      }
    } else if (dragIndex > overIndex) {
      // Dragging left: items between [overIndex, dragIndex) shift right
      if (index >= overIndex && index < dragIndex) {
        return { transform: `translateX(${shiftPx}px)`, transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' };
      }
    }

    return { transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)' };
  }, [dragIndex, overIndex]);

  /**
   * Returns event handler props to spread on each draggable item.
   */
  const getItemProps = useCallback((index) => ({
    onPointerDown: (e) => handlePointerDown(index, e),
    onPointerMove: (e) => handlePointerMove(index, e),
    onPointerUp: (e) => handlePointerUp(index, e),
    onPointerCancel: (e) => handlePointerCancel(index, e),
  }), [handlePointerDown, handlePointerMove, handlePointerUp, handlePointerCancel]);

  return {
    isDragging,
    dragIndex,
    overIndex,
    ghost,
    setItemRef,
    getItemStyle,
    getItemProps,
  };
}
