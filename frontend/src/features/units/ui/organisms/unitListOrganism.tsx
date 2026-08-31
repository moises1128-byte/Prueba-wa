'use client';

import { useUnits } from '../../application/queries/useUnits.query';
import { useDeleteUnit } from '../../application/mutations/useDeleteUnit.mutation';
import { useUnitEdit } from '../context/unitEditContext';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { EmptyState } from '@/shared/ui/molecules/emptyState';
import { ErrorState } from '@/shared/ui/molecules/errorState';
import { Button } from '@/shared/ui/atoms/button';
import { getGraphQLErrorCode } from '@/shared/utils/getGraphQLErrorCode';
import styles from './unitListOrganism.module.css';

export function UnitListOrganism() {
  const { data, loading, error } = useUnits();
  const { deleteUnit, error: deleteError } = useDeleteUnit();
  const { editingUnit, startEditing } = useUnitEdit();

  function handleDelete(id: string) {
    if (!window.confirm('Delete this unit?')) return;
    void deleteUnit(id);
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorState message="Could not load units" />;
  if (!data?.length) return <EmptyState message="No units yet" />;

  const deleteErrorMessage =
    getGraphQLErrorCode(deleteError) === 'unitHasActiveDuties'
      ? 'This unit has duties assigned. Remove them before deleting the unit.'
      : deleteError
        ? 'Failed to delete unit. Please try again.'
        : undefined;

  return (
    <div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Driver</th>
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
                  Edit
                </Button>
                <Button type="button" onClick={() => handleDelete(unit.id)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleteErrorMessage ? <ErrorState message={deleteErrorMessage} /> : null}
    </div>
  );
}
