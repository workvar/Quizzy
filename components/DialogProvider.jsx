'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { MdButton, MdDialog, useOverlay } from '@awc-ui/react';

const DialogContext = createContext(null);

const DEFAULT_CONFIRM = {
  title: 'Are you sure?',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'danger',
  mode: 'confirm',
};

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);
  const modeRef = useRef('confirm');
  const dialogRef = useRef(null);

  const finishClose = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setDialog(null);
  }, []);

  const overlay = useOverlay(dialogRef, {
    onClosed: () => {
      if (resolverRef.current) {
        finishClose(modeRef.current === 'alert' ? true : false);
      } else {
        setDialog(null);
      }
    },
  });

  const openDialog = useCallback((opts) => {
    return new Promise((resolve) => {
      if (resolverRef.current) resolverRef.current(false);
      resolverRef.current = resolve;
      const next = { ...DEFAULT_CONFIRM, ...opts };
      modeRef.current = next.mode;
      setDialog(next);
    });
  }, []);

  const confirm = useCallback((opts) => {
    if (typeof opts === 'string') {
      return openDialog({ message: opts, mode: 'confirm' });
    }
    return openDialog({ ...opts, mode: 'confirm' });
  }, [openDialog]);

  const alert = useCallback((opts) => {
    if (typeof opts === 'string') {
      return openDialog({
        title: 'Notice',
        message: opts,
        mode: 'alert',
        confirmLabel: 'OK',
        tone: 'primary',
      });
    }
    return openDialog({
      title: 'Notice',
      confirmLabel: 'OK',
      tone: 'primary',
      ...opts,
      mode: 'alert',
    });
  }, [openDialog]);

  useEffect(() => {
    if (!dialog || !dialogRef.current) return;
    dialogRef.current.show?.();
  }, [dialog]);

  const resolveAndClose = useCallback(async (result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    await dialogRef.current?.close?.();
    setDialog(null);
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog ? (
        <MdDialog
          ref={dialogRef}
          headline={dialog.title}
          icon={dialog.mode === 'alert' || dialog.tone === 'primary' ? 'info' : 'warning'}
          scrimDismissible={dialog.mode === 'alert'}
          onMdClose={overlay.onMdClose}
        >
          {dialog.message ? <p style={{ margin: 0 }}>{dialog.message}</p> : null}
          {dialog.mode === 'confirm' ? (
            <MdButton
              slot="actions"
              variant="text"
              onMdClick={() => resolveAndClose(false)}
            >
              {dialog.cancelLabel}
            </MdButton>
          ) : null}
          <MdButton
            slot="actions"
            variant="filled"
            onMdClick={() => resolveAndClose(true)}
          >
            {dialog.confirmLabel}
          </MdButton>
        </MdDialog>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return ctx;
}

export function useConfirm() {
  const { confirm } = useDialog();
  return confirm;
}

export function useAlert() {
  const { alert } = useDialog();
  return alert;
}
