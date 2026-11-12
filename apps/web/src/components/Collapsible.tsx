import { useState } from 'react';

export function Collapsible({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className="collapsible" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="collapsible-summary">
        <span className="collapsible-caret">{open ? '▾' : '▸'}</span>
        <span className="collapsible-title">{title}</span>
        {hint && <span className="collapsible-hint">{hint}</span>}
      </summary>
      <div className="collapsible-body">{children}</div>
    </details>
  );
}