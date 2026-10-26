import { useEffect, useRef, useState } from 'react';
import { Home, PieChart, Plus, Wallet, Target, type LucideIcon } from 'lucide-react';

export type AppTab = 'home' | 'stats' | 'wallet' | 'goals';

interface TabItem {
  id: AppTab;
  label: string;
  icon: LucideIcon;
}

const leftTabs: TabItem[] = [
  { id: 'home', label: 'Главная', icon: Home },
  { id: 'stats', label: 'Статистика', icon: PieChart },
];

const rightTabs: TabItem[] = [
  { id: 'wallet', label: 'Кошелёк', icon: Wallet },
  { id: 'goals', label: 'Цели', icon: Target },
];

const BAR_HEIGHT = 56;
const BTN_SIZE = 52;

export function TabBar({
  activeTab,
  onTabChange,
  onAddClick,
}: {
  activeTab: AppTab;
  onTabChange: (id: AppTab) => void;
  onAddClick: () => void;
}) {
  const [ripple, setRipple] = useState(false);
  const rippleTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (rippleTimerRef.current !== null) window.clearTimeout(rippleTimerRef.current);
  }, []);

  const handleAddClick = () => {
    setRipple(true);
    if (rippleTimerRef.current !== null) window.clearTimeout(rippleTimerRef.current);
    rippleTimerRef.current = window.setTimeout(() => {
      setRipple(false);
      rippleTimerRef.current = null;
    }, 600);
    onAddClick();
  };

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50" style={{ paddingTop: BTN_SIZE / 2 }}>
      <div className="relative">
        <nav
          aria-label="Основная навигация"
          className="relative flex items-center justify-around rounded-full px-3 glass-bar"
          style={{ height: BAR_HEIGHT }}
        >
          {leftTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            />
          ))}

          <div aria-hidden="true" style={{ width: BTN_SIZE }} className="shrink-0" />

          {rightTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              active={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
            />
          ))}
        </nav>

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={handleAddClick}
            className="plus-btn pointer-events-auto relative flex items-center justify-center overflow-hidden rounded-full transition-transform duration-200 active:scale-90 motion-reduce:transition-none"
            style={{
              width: BTN_SIZE,
              height: BTN_SIZE,
              background: 'rgba(255, 255, 255, 0.92)',
              boxShadow:
                '-3px -3px 8px rgba(255,255,255,0.95), 4px 4px 10px rgba(0,0,0,0.08), inset 0 1px 1px rgba(255,255,255,0.6)',
              border: '0.5px solid rgba(0, 0, 0, 0.05)',
            }}
            aria-label="Добавить транзакцию"
          >
            <Plus
              className="relative z-10 h-[22px] w-[22px] text-neutral-700 dark:text-white"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            {ripple && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-gradient-to-br from-mint/30 to-indigoblue/30 animate-ripple motion-reduce:animate-none"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: TabItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 px-1 py-1 transition-all duration-200 active:scale-90 motion-reduce:transition-none motion-reduce:transform-none"
      aria-label={tab.label}
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        aria-hidden="true"
        className={`h-[18px] w-[18px] transition-colors duration-200 motion-reduce:transition-none ${
          active ? 'text-mint dark:text-mint' : 'text-neutral-600 dark:text-neutral-500'
        }`}
        strokeWidth={active ? 2.5 : 2}
      />
      <span
        className={`text-[9px] leading-none font-medium transition-colors duration-200 motion-reduce:transition-none ${
          active ? 'text-neutral-800 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'
        }`}
      >
        {tab.label}
      </span>
    </button>
  );
}
