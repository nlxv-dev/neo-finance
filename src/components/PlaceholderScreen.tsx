import { useId } from 'react';
import { Sparkles, type LucideIcon } from 'lucide-react';

interface PlaceholderScreenProps {
  icon: LucideIcon;
  section: string;
  description: string;
}

export function PlaceholderScreen({ icon: Icon, section, description }: PlaceholderScreenProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-h-[70dvh] flex-col items-center justify-center px-8 pb-32 pt-20 text-center"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-mint/30 to-indigoblue/20 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] neu-card">
          <Icon className="h-9 w-9 text-mint" strokeWidth={1.6} aria-hidden="true" />
        </div>
      </div>

      <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-mint/10 px-3 py-1 text-[11px] font-medium text-mint">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        {section}
      </span>

      <h1 id={titleId} className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
        Раздел в разработке
      </h1>

      <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-500 dark:text-neutral-400">
        {description}
      </p>

      <p className="mt-6 rounded-2xl neu-inset px-4 py-3 text-xs leading-5 text-neutral-400 dark:text-neutral-500">
        Мы уже работаем над этим экраном. Пока можно вернуться на главную или посмотреть статистику.
      </p>
    </section>
  );
}
