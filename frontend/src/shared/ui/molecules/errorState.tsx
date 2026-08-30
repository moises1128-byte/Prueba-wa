import styles from './errorState.module.css';

interface ErrorStateProps {
  message: string;
}

export function ErrorState({ message }: ErrorStateProps) {
  return <p className={styles.error}>{message}</p>;
}
