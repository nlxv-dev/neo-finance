import { useState } from 'react';
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

const BAR_HEIGHT = 56; // px — h-14
const BTN_SIZE = 52;   // px — w-13 h-13

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

  const handleAddClick = () => {
    setRipple(true);
    setTimeout(() => setRipple(false), 600);
    onAddClick();
  };

  return (
    /*
     * Outer wrapper: fixed island floating above bottom edge.
     * Extra top padding = half the button overhang so the button
     * doesn't get clipped by the parent's bounds.
     */
    <div className="fixed bottom-6 left-4 right-4 z-50" style={{ paddingTop: BTN_SIZE / 2 }}>
      {/* Glass bar — exact height, no flex stretching */}
      <div
        className="relative flex items-center justify-around rounded-full px-3 glass-bar gpu"
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

        {/* Spacer keeps centre area reserved so tabs distribute evenly */}
        <div style={{ width: BTN_SIZE }} className="shrink-0" />

        {rightTabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}

        {/*
         * "+" button: absolutely placed.
         * top: -(BTN_SIZE/2) lifts it so the button's vertical centre
         * aligns exactly with the bar's top edge, then subtract half
         * the bar's own height to land on the bar's optical centre.
         * Result: button centre = bar centre.
         */}
        <button
          onClick={handleAddClick}
          className="plus-btn absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full overflow-hidden transition-transform duration-200 active:scale-90 gpu"
          style={{
            width: BTN_SIZE,
            height: BTN_SIZE,
            top: '50%',
            transform: 'translateX(-50%) translateY(-50%)',
            /* Light mode: neumorphic white raised button */
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
          />
          {ripple && (
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-mint/30 to-indigoblue/30 animate-ripple" />
          )}
        </button>
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
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 px-1 py-1 transition-all duration-200 active:scale-90 gpu"
      aria-label={tab.label}
    >
      <Icon
        className={`h-[18px] w-[18px] transition-colors duration-200 ${
          active
            ? 'text-mint dark:text-mint'
            : 'text-neutral-500 dark:text-neutral-500'
        }`}
        strokeWidth={active ? 2.5 : 2}
      />
      <span
        className={`text-[9px] leading-none font-medium transition-colors duration-200 ${
          active
            ? 'text-neutral-800 dark:text-white'
            : 'text-neutral-500 dark:text-neutral-500'
        }`}
      >
        {tab.label}
      </span>
    </button>
  );
}
