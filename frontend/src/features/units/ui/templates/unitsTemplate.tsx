import { UnitEditProvider } from '../context/unitEditContext';
import { CreateUnitOrganism } from '../organisms/createUnitOrganism';
import { UnitListOrganism } from '../organisms/unitListOrganism';
import styles from './unitsTemplate.module.css';

export function UnitsTemplate() {
  return (
    <UnitEditProvider>
      <div className={styles.layout}>
        <h1 className={styles.pageTitle}>Unidades</h1>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Nueva unidad</h2>
          <CreateUnitOrganism />
        </section>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Unidades registradas</h2>
          <UnitListOrganism />
        </section>
      </div>
    </UnitEditProvider>
  );
}
