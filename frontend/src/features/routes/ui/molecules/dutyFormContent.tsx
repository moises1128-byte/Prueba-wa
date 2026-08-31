'use client';

import { useFormContext } from 'react-hook-form';
import { Button } from '@/shared/ui/atoms/button';
import type { TDutyForm } from '../../domain/duty.form';
import styles from './dutyFormContent.module.css';

interface DutyFormContentProps {
  units: Array<{ id: string; name: string; driverName: string }>;
  disabled: boolean;
  submitLabel: string;
  onCancel?: () => void;
}

export function DutyFormContent({
  units,
  disabled,
  submitLabel,
  onCancel,
}: DutyFormContentProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TDutyForm>();

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="duty-unitId" className={styles.fieldLabel}>
          Unidad
        </label>
        <select
          {...register('unitId')}
          id="duty-unitId"
          disabled={disabled}
          className={styles.select}
        >
          <option value="">Selecciona una unidad</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name} — {unit.driverName}
            </option>
          ))}
        </select>
        {errors.unitId ? (
          <p className={styles.error}>{errors.unitId.message}</p>
        ) : null}
      </div>
      <div className={styles.field}>
        <label htmlFor="duty-startsAt" className={styles.fieldLabel}>
          Hora de partida
        </label>
        <input
          {...register('startsAt')}
          id="duty-startsAt"
          disabled={disabled}
          type="datetime-local"
          className={styles.input}
        />
        {errors.startsAt ? (
          <p className={styles.error}>{errors.startsAt.message}</p>
        ) : null}
      </div>
      <div className={styles.field}>
        <label htmlFor="duty-endsAt" className={styles.fieldLabel}>
          Hora de llegada
        </label>
        <input
          {...register('endsAt')}
          id="duty-endsAt"
          disabled={disabled}
          type="datetime-local"
          className={styles.input}
        />
        {errors.endsAt ? (
          <p className={styles.error}>{errors.endsAt.message}</p>
        ) : null}
      </div>
      <div className={styles.field}>
        <label htmlFor="duty-description" className={styles.fieldLabel}>
          Descripción (opcional)
        </label>
        <input
          {...register('description')}
          id="duty-description"
          placeholder="Ej: cubrir hora pico"
          disabled={disabled}
          type="text"
          className={styles.input}
        />
        {errors.description ? (
          <p className={styles.error}>{errors.description.message}</p>
        ) : null}
      </div>
      <div className={styles.actions}>
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" disabled={disabled} onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
