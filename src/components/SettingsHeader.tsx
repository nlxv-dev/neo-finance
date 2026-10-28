import { useEffect, useState } from 'react';

interface SettingsHeaderProps {
  title: string;
  onBack: () => void;
}

export function SettingsHeader({ title, onBack }: SettingsHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = (event: Event) => {
      const target = event.target;
      const containerScrollTop = target instanceof HTMLElement ? target.scrollTop : 0;

      setIsScrolled(window.scrollY > 10 || containerScrollTop > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-transparent px-4 py-4 flex items-center justify-start select-none">
      <div
        data-testid="header-bg"
        className={`absolute inset-0 -z-10 pointer-events-none transition-all duration-300 ease-out ${
          isScrolled
            ? 'bg-slate-50/40 backdrop-blur-lg dark:bg-neutral-900/40'
            : 'bg-transparent backdrop-blur-none'
        }`}
        style={{
          maskImage: isScrolled
            ? 'linear-gradient(to bottom, black 60%, transparent 100%)'
            : 'none',
        }}
      />

      <button
        type="button"
        aria-label="Назад"
        onClick={onBack}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl neu-card-sm transition-transform duration-200 active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-arrow-left h-5 w-5 text-neutral-700 dark:text-neutral-200"
        >
          <path d="m12 19-7-7 7-7"></path>
          <path d="M19 12H5"></path>
        </svg>
      </button>

      <h1 className="ml-4 flex h-10 items-center text-xl font-semibold tracking-tight text-slate-900 outline-none dark:text-white">
        {title}
      </h1>
    </header>
  );
}
