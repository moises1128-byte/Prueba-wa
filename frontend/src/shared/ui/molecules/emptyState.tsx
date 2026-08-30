import styles from './emptyState.module.css';

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return <p className={styles.empty}>{message}</p>;
}
