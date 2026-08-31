'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import type { TUnitForm } from '../../domain/unit.form';
import styles from './unitFormContent.module.css';

interface UnitFormContentProps {
  disabled: boolean;
  submitLabel: string;
  onCancel?: () => void;
}

export function UnitFormContent({
  disabled,
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
        placeholder="Nombre de la unidad"
      />
      {errors.name ? (
        <p className={styles.error}>{errors.name.message}</p>
      ) : null}
      <Input
        {...register('driverName')}
        disabled={disabled}
        placeholder="Nombre del conductor"
      />
      {errors.driverName ? (
        <p className={styles.error}>{errors.driverName.message}</p>
      ) : null}
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
