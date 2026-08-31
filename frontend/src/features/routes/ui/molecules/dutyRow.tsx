import { Button } from '@/shared/ui/atoms/button';
import type { Duty } from '../../domain/duty.model';
import styles from './dutyRow.module.css';

interface DutyRowProps {
  duty: Duty;
  onEdit: () => void;
  onDelete: () => void;
}

export function DutyRow({ duty, onEdit, onDelete }: DutyRowProps) {
  return (
    <div className={styles.row}>
      <span>
        {duty.unit.name} ({duty.unit.driverName})
      </span>
      <span>
        {duty.startsAt.toLocaleString()} – {duty.endsAt.toLocaleString()}
      </span>
      <div className={styles.actions}>
        <Button type="button" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
