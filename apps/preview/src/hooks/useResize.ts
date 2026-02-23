import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

export function useResize(initialSize: number, minSize: number, maxSize: number) {
  const [size, setSize] = useState(initialSize);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const startResize = (e: ReactMouseEvent, direction: 'horizontal' | 'vertical', reverse = false) => {
    e.preventDefault();
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const startSize = size;

    cleanupRef.current?.();
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      const newSize = Math.min(Math.max(startSize + (reverse ? -delta : delta), minSize), maxSize);
      setSize(newSize);
    };

    const cleanup = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (cleanupRef.current === cleanup) {
        cleanupRef.current = null;
      }
    };

    const handleMouseUp = () => {
      cleanup();
    };

    cleanupRef.current = cleanup;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return { size, startResize, setSize };
}
