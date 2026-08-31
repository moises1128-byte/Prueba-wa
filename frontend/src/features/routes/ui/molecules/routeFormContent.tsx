'use client';

import { useFormContext, useFieldArray } from 'react-hook-form';
import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import type { TRouteForm } from '../../domain/route.form';
import styles from './routeFormContent.module.css';

interface RouteFormContentProps {
  disabled: boolean;
  submitLabel: string;
}

export function RouteFormContent({
  disabled,
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
        placeholder="Nombre de la ruta (opcional)"
      />
      <div className={styles.points}>
        {fields.map((field, index) => {
          // Per-point errors live at `errors.points[index].<field>`, not on
          // `errors.points` itself — without rendering them, blanking a coordinate
          // (which `valueAsNumber` turns into NaN) or typing an out-of-range value
          // just makes the submit button do nothing, with no feedback at all.
          const pointErrors = errors.points?.[index];
          const latId = `${field.id}-lat`;
          const lngId = `${field.id}-lng`;
          const nameId = `${field.id}-name`;
          return (
            <div key={field.id} className={styles.point}>
              <span className={styles.pointLabel}>
                Punto {index + 1} en el mapa
              </span>
              <div className={styles.pointRow}>
                <div className={styles.field}>
                  <label htmlFor={latId} className={styles.fieldLabel}>
                    Latitud
                  </label>
                  <Input
                    id={latId}
                    {...register(`points.${index}.lat`, {
                      valueAsNumber: true,
                    })}
                    disabled={disabled}
                    type="number"
                    step="any"
                    placeholder="Latitud"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={lngId} className={styles.fieldLabel}>
                    Longitud
                  </label>
                  <Input
                    id={lngId}
                    {...register(`points.${index}.lng`, {
                      valueAsNumber: true,
                    })}
                    disabled={disabled}
                    type="number"
                    step="any"
                    placeholder="Longitud"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor={nameId} className={styles.fieldLabel}>
                    Nombre del punto (opcional)
                  </label>
                  <Input
                    id={nameId}
                    {...register(`points.${index}.name`)}
                    disabled={disabled}
                    placeholder="Ej: Plaza Venezuela"
                  />
                </div>
                <Button
                  type="button"
                  disabled={disabled || fields.length === 1}
                  onClick={() => remove(index)}
                >
                  Quitar
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
        Agregar punto
      </Button>
      <Button type="submit" disabled={disabled}>
        {submitLabel}
      </Button>
    </div>
  );
}
