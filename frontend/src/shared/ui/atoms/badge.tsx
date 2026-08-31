import type { ReactNode } from 'react';
import styles from './badge.module.css';

interface BadgeProps {
  tone: 'success' | 'neutral';
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  const toneClass = tone === 'success' ? styles.success : styles.neutral;
  return (
    <span className={[styles.badge, toneClass].join(' ')}>{children}</span>
  );
}
