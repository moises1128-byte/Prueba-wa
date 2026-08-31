'use client';

import { useFormContext } from 'react-hook-form';
import { Button } from '@/shared/ui/atoms/button';
import type { TDutyForm } from '../../domain/duty.form';
import styles from './dutyFormContent.module.css';

interface DutyFormContentProps {
  units: Array<{ id: string; name: string; driverName: string }>;
  disabled: boolean;
  error?: string;
  submitLabel: string;
  onCancel?: () => void;
}

export function DutyFormContent({ units, disabled, error, submitLabel, onCancel }: DutyFormContentProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TDutyForm>();

  return (
    <div className={styles.form}>
      <select {...register('unitId')} aria-label="Unit" disabled={disabled} className={styles.select}>
        <option value="">Select a unit</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.name} — {unit.driverName}
          </option>
        ))}
      </select>
      {errors.unitId ? <p className={styles.error}>{errors.unitId.message}</p> : null}
      <input
        {...register('startsAt')}
        aria-label="Start time"
        disabled={disabled}
        type="datetime-local"
        className={styles.input}
      />
      {errors.startsAt ? <p className={styles.error}>{errors.startsAt.message}</p> : null}
      <input
        {...register('endsAt')}
        aria-label="End time"
        disabled={disabled}
        type="datetime-local"
        className={styles.input}
      />
      {errors.endsAt ? <p className={styles.error}>{errors.endsAt.message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.actions}>
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" disabled={disabled} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
