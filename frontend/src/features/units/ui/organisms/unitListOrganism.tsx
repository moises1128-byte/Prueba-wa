'use client';

import { toast } from 'sonner';
import { useUnits } from '../../application/queries/useUnits.query';
import { useDeleteUnit } from '../../application/mutations/useDeleteUnit.mutation';
import { useUnitEdit } from '../context/unitEditContext';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { Button } from '@/shared/ui/atoms/button';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';
import { useConfirm } from '@/context/confirmDialogProvider';
import styles from './unitListOrganism.module.css';

function deleteUnitErrorMessage(error: unknown): string {
  if (getGraphQLErrorCode(error) === 'unitHasActiveDuties') {
    return 'Esta unidad tiene turnos asignados. Quítalos antes de eliminar la unidad.';
  }
  return 'No se pudo eliminar la unidad. Inténtalo de nuevo.';
}

export function UnitListOrganism() {
  const { data, loading, error } = useUnits();
  const { deleteUnit } = useDeleteUnit();
  const { editingUnit, startEditing } = useUnitEdit();
  const confirm = useConfirm();

  async function handleDelete(id: string) {
    if (!(await confirm('¿Eliminar esta unidad?'))) return;
    void deleteUnit(id).catch((deleteError: unknown) => {
      toast.error(deleteUnitErrorMessage(deleteError));
    });
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="No se pudieron cargar las unidades" />;
  if (!data?.length) return <EmptyState message="Todavía no hay unidades" />;

  return (
    <div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Conductor</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {data.map((unit) => (
            <tr
              key={unit.id}
              className={
                unit.id === editingUnit?.id ? styles.editing : undefined
              }
            >
              <td>{unit.name}</td>
              <td>{unit.driverName}</td>
              <td className={styles.actions}>
                <Button type="button" onClick={() => startEditing(unit)}>
                  Editar
                </Button>
                <Button type="button" onClick={() => handleDelete(unit.id)}>
                  Eliminar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
