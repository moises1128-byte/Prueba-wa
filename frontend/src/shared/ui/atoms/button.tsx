import type { ComponentProps } from 'react';
import styles from './button.module.css';

type ButtonProps = ComponentProps<'button'>;

export function Button({ children, className, ...props }: ButtonProps) {
  return (
    <button className={[styles.button, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </button>
  );
}
