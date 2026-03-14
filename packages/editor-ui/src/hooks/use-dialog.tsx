import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DialogState {
  open: boolean;
  type: 'confirm' | 'prompt';
  message: string;
  defaultValue?: string;
  resolve: ((value: boolean | string | null) => void) | null;
}

const initialState: DialogState = {
  open: false,
  type: 'confirm',
  message: '',
  resolve: null,
};

function InlineDialog({
  state,
  onConfirm,
  onCancel,
  inputRef,
  inputValue,
  setInputValue,
}: {
  state: DialogState;
  onConfirm: () => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  inputValue: string;
  setInputValue: (v: string) => void;
}) {
  if (!state.open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      {/* Dialog */}
      <div
        className="relative z-10 w-[320px] rounded-lg border border-[var(--border-ide)] bg-[var(--bg-panel)] shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Message */}
        <div className="px-4 pt-4 pb-3">
          <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">
            {state.message}
          </p>
          {state.type === 'prompt' && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="mt-3 w-full rounded border border-[var(--border-ide)] bg-[var(--bg-activity-bar)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
              autoFocus
            />
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--border-ide)]" />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-6 rounded px-3 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-6 rounded bg-blue-600 px-3 text-[12px] text-white hover:bg-blue-500 transition-colors"
            autoFocus={state.type === 'confirm'}
          >
            确认
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export interface DialogControls {
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
  DialogPortal: React.ReactNode;
}

export function useDialog(): DialogControls {
  const [state, setState] = useState<DialogState>(initialState);
  const [inputValue, setInputValue] = useState('');
  const resolveRef = useRef<((value: boolean | string | null) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve as (value: boolean | string | null) => void;
      setState({ open: true, type: 'confirm', message, resolve });
    });
  }, []);

  const prompt = useCallback((message: string, defaultValue = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve as (value: boolean | string | null) => void;
      setInputValue(defaultValue);
      setState({ open: true, type: 'prompt', message, defaultValue, resolve });
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 0);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const resolve = resolveRef.current;
    if (!resolve) return;
    resolveRef.current = null;
    setState(initialState);
    if (state.type === 'prompt') {
      resolve(inputValue);
    } else {
      resolve(true);
    }
  }, [state.type, inputValue]);

  const handleCancel = useCallback(() => {
    const resolve = resolveRef.current;
    if (!resolve) return;
    resolveRef.current = null;
    setState(initialState);
    if (state.type === 'prompt') {
      resolve(null);
    } else {
      resolve(false);
    }
  }, [state.type]);

  const DialogPortal = (
    <InlineDialog
      state={state}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      inputRef={inputRef}
      inputValue={inputValue}
      setInputValue={setInputValue}
    />
  );

  return { confirm, prompt, DialogPortal };
}
