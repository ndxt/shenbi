import React, { useCallback, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface DialogState {
  open: boolean;
  type: 'confirm' | 'prompt';
  message: string;
  defaultValue?: string;
}

const initialState: DialogState = {
  open: false,
  type: 'confirm',
  message: '',
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
  inputRef: React.RefObject<HTMLInputElement | null>;
  inputValue: string;
  setInputValue: (v: string) => void;
}) {
  // Focus logic
  useEffect(() => {
    if (state.open && state.type === 'confirm') {
      const btn = document.getElementById('dialog-confirm-btn');
      btn?.focus();
    }
  }, [state.open, state.type]);

  if (!state.open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Backdrop - extremely faint, mostly relying on shadow to separate */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" />

      {/* Dialog Box - Matches VS Code / Cursor width and shadow */}
      <div
        className="relative z-10 w-full max-w-[440px] rounded outline-none"
        style={{
          background: 'var(--color-bg-panel)',
          border: '1px solid var(--color-border-ide)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        }}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {/* Top right close button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 rounded transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)';
            e.currentTarget.style.background = 'var(--color-hover-bg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <X size={16} />
        </button>

        {/* Content Area */}
        <div className="flex px-6 pt-8 pb-4">
          <div className="flex-shrink-0 mr-5 mt-1">
            {state.type === 'confirm' ? (
              <AlertTriangle size={52} strokeWidth={1.5} color="#cca700" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center pt-1">
            <p 
              className="leading-[1.5]" 
              style={{ fontSize: 16, color: 'var(--color-text-primary)', wordBreak: 'break-word' }}
            >
              {state.message}
            </p>
            {state.type === 'prompt' && (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="mt-4 w-full rounded outline-none transition-colors"
                style={{
                  border: '1px solid var(--color-border-ide)',
                  background: 'var(--color-active-bg)',
                  padding: '6px 12px',
                  fontSize: 14,
                  color: 'var(--color-text-primary)',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--color-border-ide)'}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onConfirm();
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Actions Area - No horizontal divider */}
        <div className="flex items-center justify-end gap-3 px-6 pt-6 pb-6">
          <button
            type="button"
            onClick={onCancel}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-hover-bg)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-active-bg)'}
            className="rounded px-5 transition-colors"
            style={{
              height: 32,
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-primary)',
              background: 'var(--color-active-bg)',
              border: '1px solid var(--color-border-ide)',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          
          <button
            id="dialog-confirm-btn"
            type="button"
            onClick={onConfirm}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-primary-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-primary)'}
            className="rounded px-5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{
              height: 32,
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-inverse)',
              background: 'var(--color-primary)',
              border: 'none',
              cursor: 'pointer',
            }}
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
      setState({ open: true, type: 'confirm', message });
    });
  }, []);

  const prompt = useCallback((message: string, defaultValue = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve as (value: boolean | string | null) => void;
      setInputValue(defaultValue);
      setState({ open: true, type: 'prompt', message, defaultValue });
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
