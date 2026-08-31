'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import type { TUnitForm } from '../../domain/unit.form';
import styles from './unitFormContent.module.css';

interface UnitFormContentProps {
  disabled: boolean;
  error?: string;
  submitLabel: string;
  onCancel?: () => void;
}

export function UnitFormContent({
  disabled,
  error,
  submitLabel,
  onCancel,
}: UnitFormContentProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<TUnitForm>();

  return (
    <div className={styles.form}>
      <Input
        {...register('name')}
        disabled={disabled}
        placeholder="Unit name"
      />
      {errors.name ? (
        <p className={styles.error}>{errors.name.message}</p>
      ) : null}
      <Input
        {...register('driverName')}
        disabled={disabled}
        placeholder="Driver name"
      />
      {errors.driverName ? (
        <p className={styles.error}>{errors.driverName.message}</p>
      ) : null}
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
