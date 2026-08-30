'use client';

import React from 'react';
import type { Unit } from '../../domain/unit.model';

interface UnitEditContextValue {
  editingUnit: Unit | null;
  startEditing: (unit: Unit) => void;
  stopEditing: () => void;
}

const UnitEditContext = React.createContext<UnitEditContextValue | null>(null);

export function UnitEditProvider({ children }: { children: React.ReactNode }) {
  const [editingUnit, setEditingUnit] = React.useState<Unit | null>(null);

  const value = React.useMemo<UnitEditContextValue>(
    () => ({
      editingUnit,
      startEditing: (unit: Unit) => setEditingUnit(unit),
      stopEditing: () => setEditingUnit(null),
    }),
    [editingUnit],
  );

  return <UnitEditContext.Provider value={value}>{children}</UnitEditContext.Provider>;
}

export function useUnitEdit(): UnitEditContextValue {
  const ctx = React.useContext(UnitEditContext);
  if (!ctx) throw new Error('useUnitEdit must be used within a UnitEditProvider');
  return ctx;
}
