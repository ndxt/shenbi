import { useState } from 'react';

export function useResize(initialSize: number, minSize: number, maxSize: number) {
  const [size, setSize] = useState(initialSize);

  const startResize = (e: React.MouseEvent, direction: 'horizontal' | 'vertical', reverse = false) => {
    e.preventDefault();
    const startPos = direction === 'horizontal' ? e.clientX : e.clientY;
    const startSize = size;

    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
      const delta = currentPos - startPos;
      const newSize = Math.min(Math.max(startSize + (reverse ? -delta : delta), minSize), maxSize);
      setSize(newSize);
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return { size, startResize, setSize };
}
