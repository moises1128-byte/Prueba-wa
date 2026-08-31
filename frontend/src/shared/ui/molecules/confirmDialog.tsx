'use client';

import React from 'react';
import { Button } from '@/shared/ui/atoms/button';
import styles from './confirmDialog.module.css';

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.overlay} role="presentation" onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        onClick={(event) => event.stopPropagation()}
      >
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Button type="button" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={styles.confirmButton}
          >
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}
