import { ICONS, type IconName } from '@/data/iconRegistry';

interface IconRendererProps {
  name: string;
  className?: string;
}

export function IconRenderer({ name, className = 'h-5 w-5' }: IconRendererProps) {
  // Only render icons explicitly registered by the app. A localStorage value
  // must never select arbitrary object properties such as `toString`.
  const IconComponent = Object.prototype.hasOwnProperty.call(ICONS, name)
    ? ICONS[name as IconName]
    : ICONS.HelpCircle;

  return <IconComponent className={className} />;
}
