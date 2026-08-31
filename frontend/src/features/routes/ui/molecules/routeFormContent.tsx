'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import type { TRouteForm } from '../../domain/route.form';
import styles from './routeFormContent.module.css';

interface RouteFormContentProps {
  disabled: boolean;
  error?: string;
  submitLabel: string;
}

export function RouteFormContent({
  disabled,
  error,
  submitLabel,
}: RouteFormContentProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<TRouteForm>();
  const { fields, append, remove } = useFieldArray({ control, name: 'points' });

  return (
    <div className={styles.form}>
      <Input
        {...register('name')}
        disabled={disabled}
        placeholder="Route name (optional)"
      />
      <div className={styles.points}>
        {fields.map((field, index) => {
          // Per-point errors live at `errors.points[index].<field>`, not on
          // `errors.points` itself — without rendering them, blanking a coordinate
          // (which `valueAsNumber` turns into NaN) or typing an out-of-range value
          // just makes the submit button do nothing, with no feedback at all.
          const pointErrors = errors.points?.[index];
          return (
            <div key={field.id} className={styles.point}>
              <div className={styles.pointRow}>
                <Input
                  {...register(`points.${index}.lat`, { valueAsNumber: true })}
                  disabled={disabled}
                  type="number"
                  step="any"
                  placeholder="Latitude"
                />
                <Input
                  {...register(`points.${index}.lng`, { valueAsNumber: true })}
                  disabled={disabled}
                  type="number"
                  step="any"
                  placeholder="Longitude"
                />
                <Input
                  {...register(`points.${index}.name`)}
                  disabled={disabled}
                  placeholder="Point name (optional)"
                />
                <Button
                  type="button"
                  disabled={disabled || fields.length === 1}
                  onClick={() => remove(index)}
                >
                  Remove
                </Button>
              </div>
              {pointErrors?.lat ? (
                <p className={styles.error}>{pointErrors.lat.message}</p>
              ) : null}
              {pointErrors?.lng ? (
                <p className={styles.error}>{pointErrors.lng.message}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {errors.points?.message ? (
        <p className={styles.error}>{errors.points.message}</p>
      ) : null}
      <Button
        type="button"
        disabled={disabled}
        onClick={() => append({ lat: 0, lng: 0, name: '' })}
      >
        Add point
      </Button>
      {error ? <p className={styles.error}>{error}</p> : null}
      <Button type="submit" disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}
