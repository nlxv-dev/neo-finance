import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Archive,
  Check,
  ChevronRight,
  CircleHelp,
  CloudDownload,
  Download,
  FileJson,
  FileSpreadsheet,
  Globe2,
  HardDriveDownload,
  Languages,
  Moon,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Wallet,
  X,
  Contrast,
  type LucideIcon,
} from 'lucide-react';
import type { Transaction } from '@/data/mockData';
import { formatCurrency } from '@/data/mockData';
import { ICON_GROUPS } from '@/data/iconsConfig';
import { IconRenderer } from '@/components/IconRenderer';
import type { CustomCategory } from '@/hooks/useCategories';
import type { ThemeMode } from '@/hooks/useTheme';
import {
  downloadJsonBackup,
  downloadTransactionsCsv,
  importCsvTransactionsToStorage,
  parseTransactionsCsv,
  readLastBackupAt,
  restoreJsonBackupToStorage,
  validateBackupFile,
  type BackupFile,
  type CsvImportMode,
} from '@/backup/backupService';

interface SettingsScreenProps {
  onClose: () => void;
  userName: string;
  initialBalance: number;
  monthlyBudget: number;
  updateName: (name: string) => void;
  updateInitialBalance: (balance: number) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  transactions: Transaction[];
  categories: CustomCategory[];
  addCategory: (name: string, iconName: string, isIncome: boolean) => void;
  updateCategory: (id: string, name: string, iconName: string) => void;
  deleteCategory: (id: string) => void;
  onDownloadRecovery: () => void;
  storageWriteFailed: boolean;
}

type SettingsPage = 'root' | 'profile' | 'appearance' | 'language' | 'data' | 'categories' | 'about';

const ICON_GROUP_NAMES = Object.keys(ICON_GROUPS) as Array<keyof typeof ICON_GROUPS>;

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-2 mt-7 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400 dark:text-neutral-500">{children}</p>;
}

function SettingsRow({
  icon: Icon,
  title,
  description,
  trailing,
  onClick,
  disabled = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'active:bg-neutral-100/80 dark:active:bg-white/5'}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl neu-inset text-neutral-600 dark:text-neutral-300">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-neutral-900 dark:text-white">{title}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-neutral-400 dark:text-neutral-500">{description}</span>}
      </span>
      {trailing ?? <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />}
    </button>
  );
}

function SettingsCard({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-3xl neu-card divide-y divide-neutral-100 dark:divide-white/[0.06]">{children}</div>;
}

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-20 -mx-5 mb-5 flex items-center gap-3 border-b border-neutral-100/80 bg-white/90 px-5 py-4 backdrop-blur-xl dark:border-white/[0.07] dark:bg-amoled/90">
      <button type="button" onClick={onBack} aria-label="Назад" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl neu-card-sm active:scale-95">
        <ArrowLeft className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
      </button>
      <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight text-neutral-950 dark:text-white">{title}</h1>
    </header>
  );
}

function PrimaryButton({ children, onClick, disabled = false, type = 'button' }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
    >
      {children}
    </button>
  );
}

function CategoryEditor({
  category,
  categories,
  onSave,
  onDelete,
}: {
  category: CustomCategory | null;
  categories: CustomCategory[];
  onSave: (name: string, iconName: string, isIncome: boolean) => void;
  onDelete: (category: CustomCategory) => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [iconName, setIconName] = useState(category?.iconName ?? 'ShoppingCart');
  const [isIncome, setIsIncome] = useState(category?.isIncome ?? false);
  const [activeGroup, setActiveGroup] = useState<keyof typeof ICON_GROUPS>(() => {
    const match = ICON_GROUP_NAMES.find((group) => ICON_GROUPS[group].includes(category?.iconName ?? 'ShoppingCart'));
    return match ?? 'Покупки';
  });
  const [error, setError] = useState('');

  const handleSave = () => {
    const normalized = name.trim().toLocaleLowerCase('ru-RU');
    if (!normalized) {
      setError('Введите название категории.');
      return;
    }
    const duplicate = categories.some((item) =>
      item.id !== category?.id && !item.isArchived && item.isIncome === isIncome &&
      item.name.trim().toLocaleLowerCase('ru-RU') === normalized
    );
    if (duplicate) {
      setError('Категория с таким названием уже существует.');
      return;
    }
    onSave(name.trim(), iconName, isIncome);
  };

  return (
    <div className="space-y-5 pb-8">
      <div>
        <label className="mb-2 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Название категории</label>
        <input
          autoFocus
          value={name}
          onChange={(event) => { setName(event.target.value); setError(''); }}
          maxLength={40}
          placeholder="Например, Продукты"
          className="w-full rounded-2xl neu-inset px-4 py-3.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white"
        />
        {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      {!category && (
        <div>
          <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">Тип операции</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setIsIncome(false)} className={`rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${!isIncome ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950' : 'neu-inset text-neutral-500 dark:text-neutral-400'}`}>Расход</button>
            <button type="button" onClick={() => setIsIncome(true)} className={`rounded-2xl px-3 py-3 text-sm font-medium transition-colors ${isIncome ? 'bg-mint text-neutral-950' : 'neu-inset text-neutral-500 dark:text-neutral-400'}`}>Доход</button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">Иконка</p>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {ICON_GROUP_NAMES.map((group) => (
            <button key={group} type="button" onClick={() => setActiveGroup(group)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-colors ${activeGroup === group ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950' : 'neu-inset text-neutral-500 dark:text-neutral-400'}`}>
              {group}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2 rounded-2xl neu-inset p-2">
          {ICON_GROUPS[activeGroup].map((item) => (
            <button key={item} type="button" onClick={() => setIconName(item)} aria-label={`Иконка ${item}`} aria-pressed={iconName === item} className={`flex aspect-square items-center justify-center rounded-xl transition-colors ${iconName === item ? 'bg-mint/20 text-emerald-600 ring-1 ring-mint dark:text-mint' : 'text-neutral-500 hover:bg-white/70 dark:text-neutral-400 dark:hover:bg-white/5'}`}>
              <IconRenderer name={item} className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl neu-card p-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl neu-inset text-neutral-800 dark:text-neutral-100">
          <IconRenderer name={iconName} className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{name.trim() || 'Название категории'}</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{isIncome ? 'Доход' : 'Расход'}</p>
        </div>
      </div>

      <PrimaryButton onClick={handleSave}><Check className="h-4 w-4" /> Сохранить категорию</PrimaryButton>
      {category && (
        <button type="button" onClick={() => onDelete(category)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/5 active:scale-[0.99]">
          <Trash2 className="h-4 w-4" /> Удалить категорию
        </button>
      )}
    </div>
  );
}

export function SettingsScreen(props: SettingsScreenProps) {
  const {
    onClose, userName, initialBalance, monthlyBudget, updateName, updateInitialBalance,
    themeMode, setThemeMode, transactions, categories, addCategory, updateCategory,
    deleteCategory, onDownloadRecovery, storageWriteFailed,
  } = props;
  const [page, setPage] = useState<SettingsPage>('root');
  const [nameInput, setNameInput] = useState(userName);
  const [balanceInput, setBalanceInput] = useState(String(initialBalance));
  const [editorCategoryId, setEditorCategoryId] = useState<string | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomCategory | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupFile | null>(null);
  const [pendingCsvTransactions, setPendingCsvTransactions] = useState<Transaction[] | null>(null);
  const [csvMode, setCsvMode] = useState<CsvImportMode>('replace');
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => readLastBackupAt());
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (page === 'profile') {
      setNameInput(userName);
      setBalanceInput(String(initialBalance));
    }
  }, [page, userName, initialBalance]);

  const backToRoot = () => {
    setPage('root');
    setEditorCategoryId(null);
    setDeleteTarget(null);
    setMessage(null);
  };

  const handleProfileSave = () => {
    const parsedBalance = Number(balanceInput);
    if (!Number.isFinite(parsedBalance) || parsedBalance < 0) {
      setMessage({ type: 'error', text: 'Начальный баланс должен быть неотрицательным числом.' });
      return;
    }
    updateName(nameInput);
    updateInitialBalance(Math.round(parsedBalance));
    setMessage({ type: 'info', text: 'Профиль сохранён.' });
    window.setTimeout(() => setPage('root'), 250);
  };

  const handleJsonExport = () => {
    try {
      const exportedAt = downloadJsonBackup({
        transactions,
        categories,
        profile: { userName, initialBalance, monthlyBudget },
        settings: { themeMode },
      });
      setLastBackupAt(exportedAt);
      setMessage({ type: 'info', text: 'JSON-резервная копия сформирована на этом устройстве.' });
    } catch {
      setMessage({ type: 'error', text: 'Не удалось сформировать резервную копию. Проверьте доступность хранилища браузера.' });
    }
  };

  const handleCsvExport = () => {
    try {
      downloadTransactionsCsv(transactions);
      setMessage({ type: 'info', text: 'CSV-файл с историей транзакций сформирован.' });
    } catch {
      setMessage({ type: 'error', text: 'Не удалось экспортировать историю в CSV.' });
    }
  };

  const handleJsonFile = async (file?: File) => {
    setMessage(null);
    setPendingBackup(null);
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Файл слишком большой. Максимальный размер — 50 МБ.');
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const validated = validateBackupFile(parsed);
      setPendingBackup(validated);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось прочитать JSON-файл.' });
    } finally {
      if (jsonFileRef.current) jsonFileRef.current.value = '';
    }
  };

  const handleCsvFile = async (file?: File) => {
    setMessage(null);
    setPendingCsvTransactions(null);
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Файл слишком большой. Максимальный размер — 50 МБ.');
      const text = await file.text();
      const parsed = parseTransactionsCsv(text);
      setPendingCsvTransactions(parsed);
      setCsvMode('replace');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось прочитать CSV-файл.' });
    } finally {
      if (csvFileRef.current) csvFileRef.current.value = '';
    }
  };

  const confirmJsonRestore = () => {
    if (!pendingBackup) return;
    try {
      restoreJsonBackupToStorage(pendingBackup);
      window.location.reload();
    } catch (error) {
      setPendingBackup(null);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось восстановить резервную копию.' });
    }
  };

  const confirmCsvImport = () => {
    if (!pendingCsvTransactions) return;
    try {
      importCsvTransactionsToStorage(pendingCsvTransactions, transactions, categories, csvMode);
      window.location.reload();
    } catch (error) {
      setPendingCsvTransactions(null);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Не удалось импортировать CSV.' });
    }
  };

  const startCategoryEditor = (category: CustomCategory | null) => {
    setMessage(null);
    setEditorCategoryId(category?.id ?? 'new');
  };

  const saveCategory = (name: string, iconName: string, isIncome: boolean) => {
    if (editorCategoryId === 'new') addCategory(name, iconName, isIncome);
    else if (editorCategoryId) updateCategory(editorCategoryId, name, iconName);
    setEditorCategoryId(null);
    setMessage({ type: 'info', text: 'Категории обновлены.' });
  };

  const commitDeleteCategory = (category: CustomCategory) => {
    deleteCategory(category.id);
    setDeleteTarget(null);
    setEditorCategoryId(null);
    setMessage({ type: 'info', text: `Категория «${category.name}» больше не будет доступна для новых транзакций.` });
  };

  const selectedEditorCategory = editorCategoryId && editorCategoryId !== 'new'
    ? categories.find((category) => category.id === editorCategoryId) ?? null
    : null;

  const parsedBackupDate = lastBackupAt ? new Date(lastBackupAt) : null;
  const formattedBackupDate = parsedBackupDate && Number.isFinite(parsedBackupDate.getTime())
    ? parsedBackupDate.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Ещё не создавалась';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-white text-neutral-900 dark:bg-amoled dark:text-white">
      <div className="mx-auto min-h-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-[calc(env(safe-area-inset-top)+12px)]">
        {page === 'root' && (
          <>
            <header className="flex items-center gap-3 pb-2 pt-2">
              <button type="button" onClick={onClose} aria-label="Вернуться на главный экран" className="flex h-10 w-10 items-center justify-center rounded-2xl neu-card-sm active:scale-95">
                <ArrowLeft className="h-5 w-5 text-neutral-700 dark:text-neutral-200" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">NEO FINANCE</p>
                <h1 className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">Настройки</h1>
              </div>
            </header>

            <SectionLabel>Аккаунт</SectionLabel>
            <button type="button" onClick={() => setPage('profile')} className="flex w-full items-center gap-3 rounded-3xl neu-card p-4 text-left transition-transform active:scale-[0.99]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-mint/30 to-indigo-400/20 text-neutral-900 dark:text-white">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-neutral-950 dark:text-white">{userName}</p>
                <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">Профиль и начальный баланс</p>
              </div>
              <ChevronRight className="h-5 w-5 text-neutral-400" />
            </button>

            <SectionLabel>Предпочтения</SectionLabel>
            <SettingsCard>
              <SettingsRow icon={Palette} title="Оформление" description={themeMode === 'system' ? 'Системная тема' : themeMode === 'light' ? 'Светлая тема' : 'Тёмная тема'} onClick={() => setPage('appearance')} />
              <SettingsRow icon={Languages} title="Язык" description="Русский" onClick={() => setPage('language')} />
            </SettingsCard>

            <SectionLabel>Данные</SectionLabel>
            <SettingsCard>
              <SettingsRow icon={HardDriveDownload} title="Резервное копирование" description="JSON-бэкап и CSV истории транзакций" onClick={() => { setMessage(null); setPage('data'); }} />
              <SettingsRow icon={Archive} title="Категории" description={`${categories.filter((item) => !item.isArchived).length} активных категорий`} onClick={() => { setMessage(null); setPage('categories'); }} />
            </SettingsCard>

            <SectionLabel>Приложение</SectionLabel>
            <SettingsCard>
              <SettingsRow icon={CircleHelp} title="О Neo Finance" description="О приложении и хранении данных" onClick={() => setPage('about')} />
            </SettingsCard>
          </>
        )}

        {page === 'profile' && (
          <>
            <PageHeader title="Профиль" onBack={backToRoot} />
            <p className="mb-5 text-sm leading-6 text-neutral-500 dark:text-neutral-400">Имя и начальный баланс используются на главном экране и в расчёте общего баланса.</p>
            <div className="space-y-5">
              <div>
                <label htmlFor="settings-profile-name" className="mb-2 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Имя пользователя</label>
                <input id="settings-profile-name" autoComplete="nickname" value={nameInput} onChange={(event) => setNameInput(event.target.value)} maxLength={40} placeholder="Пользователь" className="w-full rounded-2xl neu-inset px-4 py-3.5 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white" />
              </div>
              <div>
                <label htmlFor="settings-profile-balance" className="mb-2 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Начальный баланс</label>
                <div className="flex items-center rounded-2xl neu-inset px-4 py-3.5">
                  <input id="settings-profile-balance" inputMode="numeric" value={balanceInput ? formatCurrency(Number(balanceInput)) : ''} onChange={(event) => setBalanceInput(event.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="0" className="min-w-0 flex-1 bg-transparent text-sm tabular-nums text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white" />
                  <span className="ml-3 text-sm text-neutral-400">₽</span>
                </div>
              </div>
              {message && <p role="status" className={`text-xs leading-5 ${message.type === 'error' ? 'text-red-500' : 'text-emerald-600 dark:text-mint'}`}>{message.text}</p>}
              <div className="pt-2"><PrimaryButton onClick={handleProfileSave}><Check className="h-4 w-4" /> Сохранить изменения</PrimaryButton></div>
            </div>
          </>
        )}

        {page === 'appearance' && (
          <>
            <PageHeader title="Оформление" onBack={backToRoot} />
            <p className="mb-5 text-sm leading-6 text-neutral-500 dark:text-neutral-400">Выберите, как Neo Finance должен выглядеть на вашем устройстве.</p>
            <SectionLabel>Тема</SectionLabel>
            <SettingsCard>
              <button type="button" onClick={() => setThemeMode('system')} className="flex min-h-[70px] w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-100/80 dark:active:bg-white/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl neu-inset"><Contrast className="h-5 w-5 text-neutral-600 dark:text-neutral-300" /></span>
                <span className="flex-1"><span className="block text-sm font-medium">Системная</span><span className="mt-0.5 block text-xs text-neutral-400">Следовать теме устройства</span></span>
                {themeMode === 'system' && <Check className="h-5 w-5 text-emerald-500" />}
              </button>
              <button type="button" onClick={() => setThemeMode('light')} className="flex min-h-[70px] w-full items-center gap-3 border-t border-neutral-100 px-4 py-3 text-left active:bg-neutral-100/80 dark:border-white/[0.06] dark:active:bg-white/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl neu-inset"><Sun className="h-5 w-5 text-neutral-600 dark:text-neutral-300" /></span>
                <span className="flex-1"><span className="block text-sm font-medium">Светлая</span><span className="mt-0.5 block text-xs text-neutral-400">Светлый фон и контрастный текст</span></span>
                {themeMode === 'light' && <Check className="h-5 w-5 text-emerald-500" />}
              </button>
              <button type="button" onClick={() => setThemeMode('dark')} className="flex min-h-[70px] w-full items-center gap-3 border-t border-neutral-100 px-4 py-3 text-left active:bg-neutral-100/80 dark:border-white/[0.06] dark:active:bg-white/5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl neu-inset"><Moon className="h-5 w-5 text-neutral-600 dark:text-neutral-300" /></span>
                <span className="flex-1"><span className="block text-sm font-medium">Тёмная</span><span className="mt-0.5 block text-xs text-neutral-400">Тёмный интерфейс</span></span>
                {themeMode === 'dark' && <Check className="h-5 w-5 text-emerald-500" />}
              </button>
            </SettingsCard>
            <SectionLabel>Движение</SectionLabel>
            <SettingsCard>
              <SettingsRow icon={RotateCcw} title="Анимации" description="Настройка появится после перехода на Motion for React" disabled trailing={<span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-400 dark:bg-white/5">Позже</span>} />
            </SettingsCard>
            <p className="mt-3 px-1 text-xs leading-5 text-neutral-400 dark:text-neutral-500">Сейчас переключение темы работает сразу. Дополнительные настройки движения появятся вместе с новым анимационным движком.</p>
          </>
        )}

        {page === 'language' && (
          <>
            <PageHeader title="Язык" onBack={backToRoot} />
            <p className="mb-5 text-sm leading-6 text-neutral-500 dark:text-neutral-400">Язык приложения будет переключаться здесь после завершения локализации всех экранов и сообщений.</p>
            <SectionLabel>Доступный язык</SectionLabel>
            <SettingsCard>
              <div className="flex min-h-[72px] items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl neu-inset"><Globe2 className="h-5 w-5 text-neutral-600 dark:text-neutral-300" /></span>
                <span className="flex-1"><span className="block text-sm font-medium">Русский</span><span className="mt-0.5 block text-xs text-neutral-400">Текущий язык интерфейса</span></span>
                <Check className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex items-start gap-3 border-t border-neutral-100 px-4 py-4 dark:border-white/[0.06]">
                <Languages className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400" />
                <p className="text-xs leading-5 text-neutral-400 dark:text-neutral-500">Другие языки пока отключены, чтобы интерфейс не смешивал переведённые и непереведённые элементы.</p>
              </div>
            </SettingsCard>
          </>
        )}

        {page === 'data' && (
          <>
            <PageHeader title="Данные и бэкап" onBack={backToRoot} />
            <div className="rounded-3xl neu-card p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint/15 text-emerald-600 dark:text-mint"><ShieldCheck className="h-5 w-5" /></span>
                <div><h2 className="text-sm font-semibold">Защитите свои финансовые данные</h2><p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">JSON содержит данные для полного восстановления. CSV предназначен для таблиц и переносит историю транзакций.</p></div>
              </div>
              <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-white/[0.06]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Последняя JSON-копия</p>
                <p className="mt-1 text-sm font-medium">{formattedBackupDate}</p>
              </div>
            </div>

            {storageWriteFailed && <div role="status" className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">Браузер не подтвердил сохранение некоторых изменений. Перед импортом сохраните текущие данные в файл и проверьте свободное место в хранилище.</div>}
            {message && <div role={message.type === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-2xl p-3 text-xs leading-5 ${message.type === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-mint'}`}>{message.text}</div>}

            <SectionLabel>Полная резервная копия</SectionLabel>
            <SettingsCard>
              <SettingsRow icon={Download} title="Экспортировать JSON" description="Все транзакции, категории, профиль, бюджет и тема" onClick={handleJsonExport} />
              <SettingsRow icon={Upload} title="Импортировать JSON" description="Полностью восстановить данные из файла" onClick={() => { setMessage(null); jsonFileRef.current?.click(); }} />
            </SettingsCard>
            <SectionLabel>Таблицы и совместимость</SectionLabel>
            <SettingsCard>
              <SettingsRow icon={FileSpreadsheet} title="Экспортировать CSV" description={`${transactions.length} транзакций · Excel и Google Sheets`} onClick={handleCsvExport} />
              <SettingsRow icon={FileSpreadsheet} title="Импортировать CSV" description="Заменить историю или добавить транзакции из CSV" onClick={() => { setMessage(null); csvFileRef.current?.click(); }} />
            </SettingsCard>
            <input ref={jsonFileRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void handleJsonFile(event.target.files?.[0])} />
            <input ref={csvFileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void handleCsvFile(event.target.files?.[0])} />
            <div className="mt-5 rounded-2xl neu-inset p-3">
              <p className="text-xs font-semibold leading-5 text-neutral-700 dark:text-neutral-200">Резервные копии хранятся локально.</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Чтобы не потерять данные при потере или поломке устройства, по возможности сохраните файл в облачном хранилище, которому доверяете, или перенесите его на другое устройство. Резервная копия содержит финансовую информацию.</p>
              {storageWriteFailed && (
                <button type="button" onClick={onDownloadRecovery} className="mt-3 inline-flex items-center gap-2 py-1 text-xs font-medium text-neutral-700 underline decoration-neutral-300 underline-offset-4 dark:text-neutral-300"><CloudDownload className="h-4 w-4" /> Скачать аварийный файл восстановления</button>
              )}
            </div>
          </>
        )}

        {page === 'categories' && (
          <>
            <PageHeader title="Категории" onBack={backToRoot} />
            {editorCategoryId === null ? (
              <>
                <p className="mb-5 text-sm leading-6 text-neutral-500 dark:text-neutral-400">Категории используются в форме транзакций. При удалении используемая категория архивируется, а старые записи сохраняются.</p>
                <PrimaryButton onClick={() => startCategoryEditor(null)}><Plus className="h-4 w-4" /> Новая категория</PrimaryButton>
                {(['expense', 'income'] as const).map((group) => {
                  const isIncome = group === 'income';
                  const items = categories.filter((category) => !category.isArchived && category.isIncome === isIncome);
                  return (
                    <div key={group}>
                      <SectionLabel>{isIncome ? 'Доходы' : 'Расходы'}</SectionLabel>
                      <SettingsCard>
                        {items.length ? items.map((category) => (
                          <button key={category.id} type="button" onClick={() => startCategoryEditor(category)} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-100/80 dark:active:bg-white/5">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl neu-inset text-neutral-700 dark:text-neutral-200"><IconRenderer name={category.iconName} className="h-5 w-5" /></span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{category.name}</span><span className="mt-0.5 block text-[10px] text-neutral-400">{isIncome ? 'Доходная категория' : 'Расходная категория'}</span></span>
                            <Pencil className="h-4 w-4 text-neutral-400" />
                          </button>
                        )) : <p className="px-4 py-5 text-xs text-neutral-400">Нет категорий</p>}
                      </SettingsCard>
                    </div>
                  );
                })}
                {categories.some((category) => category.isArchived) && (
                  <>
                    <SectionLabel>Архив</SectionLabel>
                    <SettingsCard>
                      {categories.filter((category) => category.isArchived).map((category) => (
                        <div key={category.id} className="flex min-h-[60px] items-center gap-3 px-4 py-3 opacity-60">
                          <span className="flex h-9 w-9 items-center justify-center rounded-xl neu-inset"><IconRenderer name={category.iconName} className="h-4 w-4" /></span>
                          <span className="min-w-0 flex-1 truncate text-sm">{category.name}</span>
                          <span className="text-[10px] text-neutral-400">Архив</span>
                        </div>
                      ))}
                    </SettingsCard>
                  </>
                )}
                {message && <p role="status" className="mt-4 text-xs text-emerald-600 dark:text-mint">{message.text}</p>}
              </>
            ) : (
              <>
                <button type="button" onClick={() => setEditorCategoryId(null)} className="mb-4 inline-flex items-center gap-2 py-1 text-xs font-medium text-neutral-500"><ArrowLeft className="h-4 w-4" /> К списку категорий</button>
                <h2 className="mb-5 text-lg font-semibold">{editorCategoryId === 'new' ? 'Новая категория' : 'Редактирование категории'}</h2>
                <CategoryEditor
                  key={editorCategoryId}
                  category={selectedEditorCategory}
                  categories={categories}
                  onSave={saveCategory}
                  onDelete={setDeleteTarget}
                />
              </>
            )}
          </>
        )}

        {page === 'about' && (
          <>
            <PageHeader title="О Neo Finance" onBack={backToRoot} />
            <div className="rounded-3xl neu-card p-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-mint/30 to-indigo-400/25"><Wallet className="h-8 w-8 text-neutral-800 dark:text-white" /></div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">Neo Finance</h2>
              <p className="mt-1 text-xs text-neutral-400">Личные финансы без лишнего шума</p>
              <div className="mx-auto mt-4 h-1 w-12 rounded-full bg-gradient-to-r from-mint to-indigoblue" />
            </div>
            <SectionLabel>Приватность и данные</SectionLabel>
            <SettingsCard>
              <SettingsRow icon={ShieldCheck} title="Локальное хранение" description="Основные данные приложения сохраняются в хранилище этого браузера." trailing={<Check className="h-4 w-4 text-emerald-500" />} />
              <SettingsRow icon={FileJson} title="Резервная копия" description="JSON позволяет перенести или восстановить профиль, бюджет, категории и историю." onClick={() => setPage('data')} />
            </SettingsCard>
            <p className="mt-5 px-1 text-xs leading-5 text-neutral-400 dark:text-neutral-500">Neo Finance — независимый проект. Регулярно сохраняйте JSON-копию и храните её в безопасном месте.</p>
          </>
        )}
      </div>

      {(pendingBackup || pendingCsvTransactions || deleteTarget) && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-neutral-950/55 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-8 backdrop-blur-sm sm:items-center sm:pb-8">
          <section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-neutral-950">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {pendingBackup ? <FileJson className="h-5 w-5" /> : pendingCsvTransactions ? <FileSpreadsheet className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
                  {pendingBackup ? 'Восстановить JSON-бэкап?' : pendingCsvTransactions ? 'Импортировать CSV?' : 'Удалить категорию?'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                  {pendingBackup
                    ? `Текущие данные будут заменены. Файл содержит ${pendingBackup.data.transactions.length} транзакций и ${pendingBackup.data.categories.length} категорий, а также профиль, бюджет и тему.`
                    : pendingCsvTransactions
                      ? `В файле ${pendingCsvTransactions.length} транзакций. Выберите, что сделать с текущей историей. Профиль и бюджет не изменятся.`
                      : `Категория «${deleteTarget?.name}» исчезнет из выбора. Если она используется в истории, записи останутся и категория будет архивирована.`}
                </p>
              </div>
              <button type="button" onClick={() => { setPendingBackup(null); setPendingCsvTransactions(null); setDeleteTarget(null); }} aria-label="Закрыть" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full neu-inset"><X className="h-4 w-4" /></button>
            </div>

            {pendingCsvTransactions && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setCsvMode('replace')} className={`rounded-2xl border px-3 py-3 text-left transition-colors ${csvMode === 'replace' ? 'border-mint bg-mint/10' : 'border-neutral-200 dark:border-white/10'}`}>
                  <span className="block text-sm font-semibold">Заменить</span><span className="mt-1 block text-[11px] text-neutral-400">Только транзакции из CSV</span>
                </button>
                <button type="button" onClick={() => setCsvMode('append')} className={`rounded-2xl border px-3 py-3 text-left transition-colors ${csvMode === 'append' ? 'border-mint bg-mint/10' : 'border-neutral-200 dark:border-white/10'}`}>
                  <span className="block text-sm font-semibold">Добавить</span><span className="mt-1 block text-[11px] text-neutral-400">Пропускать совпадающие ID</span>
                </button>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => { setPendingBackup(null); setPendingCsvTransactions(null); setDeleteTarget(null); }} className="min-h-12 flex-1 rounded-2xl neu-inset px-3 text-sm font-medium text-neutral-600 dark:text-neutral-300">Отмена</button>
              <button type="button" onClick={pendingBackup ? confirmJsonRestore : pendingCsvTransactions ? confirmCsvImport : () => deleteTarget && commitDeleteCategory(deleteTarget)} className={`min-h-12 flex-1 rounded-2xl px-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] ${deleteTarget && !pendingBackup && !pendingCsvTransactions ? 'bg-red-500' : 'bg-gradient-to-r from-mint to-indigoblue text-neutral-950'}`}>
                {pendingBackup ? 'Восстановить' : pendingCsvTransactions ? (csvMode === 'replace' ? 'Заменить историю' : 'Добавить') : 'Удалить категорию'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
