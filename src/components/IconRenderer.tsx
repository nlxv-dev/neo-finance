import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ICON_GROUPS } from '@/data/iconsConfig';

interface IconRendererProps {
  name: string;
  className?: string;
}

// Only render icons explicitly offered by the category editor (plus names used
// by older saved data). A localStorage value must never select arbitrary
// lucide-react namespace exports such as `icons` or `createLucideIcon`.
const SAFE_ICON_NAMES = new Set<string>([
  ...Object.values(ICON_GROUPS).flat(),
  'HelpCircle',
  'Home',
]);

/** Lucide React icons are normally React.forwardRef objects, not functions. */
function isRenderableLucideIcon(value: unknown): value is LucideIcon {
  if (typeof value === 'function') return true;
  if (typeof value !== 'object' || value === null) return false;

  return (
    (value as { $$typeof?: unknown }).$$typeof ===
    Symbol.for('react.forward_ref')
  );
}

export function IconRenderer({ name, className = 'h-5 w-5' }: IconRendererProps) {
  const icons = LucideIcons as unknown as Record<string, unknown>;
  const candidate = SAFE_ICON_NAMES.has(name) ? icons[name] : undefined;
  const IconComponent = isRenderableLucideIcon(candidate)
    ? candidate
    : LucideIcons.HelpCircle;

  return <IconComponent className={className} />;
}
