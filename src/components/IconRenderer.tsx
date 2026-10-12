import * as LucideIcons from 'lucide-react';

interface IconRendererProps {
  name: string;
  className?: string;
}

export function IconRenderer({ name, className = 'h-5 w-5' }: IconRendererProps) {
  // Динамически вытаскиваем иконку по её текстовому имени.
  // Если иконка не найдена (или опечатка), рендерим дефолтный знак вопроса
  const IconComponent = (LucideIcons as any)[name];

  if (!IconComponent) {
    return <LucideIcons.HelpCircle className={className} />;
  }

  return <IconComponent className={className} />;
}
