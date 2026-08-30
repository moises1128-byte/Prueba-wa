import { UnitEditProvider } from '../context/unitEditContext';
import { CreateUnitOrganism } from '../organisms/createUnitOrganism';
import { UnitListOrganism } from '../organisms/unitListOrganism';
import styles from './unitsTemplate.module.css';

export function UnitsTemplate() {
  return (
    <UnitEditProvider>
      <div className={styles.layout}>
        <CreateUnitOrganism />
        <UnitListOrganism />
      </div>
    </UnitEditProvider>
  );
}
