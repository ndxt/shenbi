import React from 'react';

export function StatusBar() {
  return (
    <div className="h-[22px] bg-blue-600 flex items-center justify-between px-3 text-[12px] text-white shrink-0">
      <div className="flex items-center gap-4">
        <span>Ready</span>
        <span>Errors: 0</span>
        <span>Warnings: 0</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Schema: v1.0</span>
        <span>UTF-8</span>
        <span>TypeScript React</span>
      </div>
    </div>
  );
}
