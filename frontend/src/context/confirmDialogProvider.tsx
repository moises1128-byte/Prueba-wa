'use client';

import React from 'react';
import { ConfirmDialog } from '@/shared/ui/molecules/confirmDialog';

interface PendingConfirm {
  message: string;
  resolve: (confirmed: boolean) => void;
}

interface ConfirmDialogContextValue {
  confirm: (message: string) => Promise<boolean>;
}

const ConfirmDialogContext =
  React.createContext<ConfirmDialogContextValue | null>(null);

export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);

  const confirm = React.useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setPending({ message, resolve });
    });
  }, []);

  function respond(confirmed: boolean) {
    pending?.resolve(confirmed);
    setPending(null);
  }

  const value = React.useMemo<ConfirmDialogContextValue>(
    () => ({ confirm }),
    [confirm],
  );

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {pending ? (
        <ConfirmDialog
          message={pending.message}
          onConfirm={() => respond(true)}
          onCancel={() => respond(false)}
        />
      ) : null}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirm(): (message: string) => Promise<boolean> {
  const ctx = React.useContext(ConfirmDialogContext);
  if (!ctx)
    throw new Error('useConfirm must be used within a ConfirmDialogProvider');
  return ctx.confirm;
}
