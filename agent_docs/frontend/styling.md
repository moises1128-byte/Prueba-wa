---
description: Styling approach — CSS Modules, design tokens as CSS custom properties, per Atomic Design level
globs: "frontend/src/**/*.tsx, frontend/src/**/*.module.css"
alwaysApply: false
---

# Styling — Frontend

This project uses **CSS Modules** (what `create-next-app` scaffolded — `globals.css` +
`*.module.css`), not Tailwind. There is no `@repo/ui` design-system package here; components own
their styles directly.

If the project later wants Tailwind + a component library (shadcn/ui is a common pairing), that's
a deliberate addition — install it when a real need shows up, don't half-adopt it by copying
class names from an unrelated project.

---

## File convention

Every component gets a co-located `*.module.css` file, scoped by CSS Modules automatically (class
names are hashed at build time — no global collisions).

```
shared/ui/atoms/button.tsx
shared/ui/atoms/button.module.css
```

```css
/* button.module.css */
.button {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-brand-solid);
  color: var(--color-on-brand);
}
```

```tsx
// button.tsx
import styles from './button.module.css';

export function Button({ children, ...props }: React.ComponentProps<'button'>) {
  return (
    <button className={styles.button} {...props}>
      {children}
    </button>
  );
}
```

---

## Design tokens — CSS custom properties

Define semantic tokens once in `app/globals.css`, and reference them by name everywhere — never
hardcode a color, spacing value, or radius directly in a component's `.module.css`.

```css
/* app/globals.css */
:root {
  --color-brand-solid: #2563eb;
  --color-on-brand: #ffffff;
  --color-surface: #ffffff;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-error: #dc2626;

  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;

  --radius-md: 0.375rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #0f172a;
    --color-text-primary: #f8fafc;
    --color-text-secondary: #cbd5e1;
  }
}
```

Why: a token layer means a color/spacing change happens in one file, and dark mode is a matter of
redefining the token, not hunting every component that used a raw hex value.

---

## Where styles live, by Atomic Design level

- **Atoms**: own all their visual variants in their `.module.css` (size, tone, disabled state).
- **Molecules**: mostly layout (flex/grid gap between the atoms they compose) — minimal new visual
  rules.
- **Organisms / Templates**: layout only (grid areas, section spacing). Never redefine an atom's
  internal styling from outside — if an atom needs a new variant, add it to the atom.

```css
/* organisms/dutyListOrganism.module.css — layout only */
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
```

---

## Responsive design

Mobile-first: write the base rule for small screens, add `@media (min-width: ...)` for larger
ones.

```css
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

@media (min-width: 768px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
```

---

## Anti-patterns

- **Hardcoded colors/spacing in component CSS** — Use the token custom properties from
  `globals.css`.
- **Global class names outside `globals.css`** — Use CSS Modules everywhere else; a global class
  leaking into two unrelated components is how style bugs happen.
- **An organism overriding an atom's internal CSS** — Add a variant prop to the atom instead.
- **Copying Tailwind utility classes from another project's docs** — Tailwind isn't installed
  here; write plain CSS against the token custom properties.
