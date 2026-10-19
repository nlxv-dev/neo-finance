import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface IconRendererProps {
  name: string;
  className?: string;
}

export function IconRenderer({ name, className = 'h-5 w-5' }: IconRendererProps) {
  // Динамически извлекаем иконку по её текстовому имени.
  // Если иконка не найдена (или есть опечатка), показываем знак вопроса.
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = icons[name];

  if (!IconComponent) {
    return <LucideIcons.HelpCircle className={className} />;
  }

  return <IconComponent className={className} />;
}
