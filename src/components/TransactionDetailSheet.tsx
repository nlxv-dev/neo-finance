import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';
import { formatCurrency, type Transaction } from '@/data/mockData';
import type { CustomCategory } from '@/hooks/useCategories';
import { IconRenderer } from '@/components/IconRenderer';
import { DeleteConfirmationPanel } from '@/components/DeleteConfirmationPanel';
import { AmountKeyboard, AmountTrigger } from '@/components/AmountKeyboard';
import { BottomSheet } from '@/components/ui/BottomSheet';

type TxType = 'expense' | 'income';
type TransactionUpdates = { amount: number; categoryId: string; isIncome: boolean };

interface TransactionDetailSheetProps {
  open: boolean;
  transaction: Transaction | null;
  categories: CustomCategory[];
  onClose: () => void;
  onExited?: () => void;
  onUpdate: (id: number, updates: TransactionUpdates) => void;
  onDelete: (id: number) => void;
}

export function TransactionDetailSheet({
  open,
  transaction,
  categories,
  onClose,
  onExited,
  onUpdate,
  onDelete,
}: TransactionDetailSheetProps) {
  const [snapshot, setSnapshot] = useState<Transaction | null>(transaction);
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editType, setEditType] = useState<TxType>('expense');
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setSnapshot(transaction);
    setMode('view');
    setEditAmount(String(transaction.amount));
    setEditCategoryId(transaction.categoryId ?? '');
    setEditType(transaction.isIncome ? 'income' : 'expense');
    setKeyboardOpen(false);
  }, [transaction]);

  const activeTransaction = transaction ?? snapshot;
  if (!activeTransaction) return null;

  const currentCategory = categories.find((category) => category.id === activeTransaction.categoryId);
  const categoryName = currentCategory?.name ?? activeTransaction.category;
  const categoryIconName = currentCategory?.iconName ?? activeTransaction.categoryIconName ?? 'HelpCircle';
  const editCategories = categories.filter(
    (category) =>
      category.isIncome === (editType === 'income') &&
      (!category.isArchived || category.id === activeTransaction.categoryId)
  );

  const startEditing = () => {
    const transactionType: TxType = activeTransaction.isIncome ? 'income' : 'expense';
    const current = categories.find((category) => category.id === activeTransaction.categoryId);
    const fallback = categories.find(
      (category) => !category.isArchived && category.isIncome === activeTransaction.isIncome
    );
    setEditAmount(String(activeTransaction.amount));
    setEditType(transactionType);
    setEditCategoryId(current && current.isIncome === activeTransaction.isIncome
      ? current.id
      : fallback?.id ?? '');
    setKeyboardOpen(false);
    setMode('edit');
  };

  const handleEditTypeChange = (nextType: TxType) => {
    setEditType(nextType);
    const isIncome = nextType === 'income';
    const selectable = categories.filter(
      (category) =>
        category.isIncome === isIncome &&
        (!category.isArchived || category.id === activeTransaction.categoryId)
    );
    setEditCategoryId((currentId) =>
      selectable.some((category) => category.id === currentId)
        ? currentId
        : (selectable[0]?.id ?? '')
    );
  };

  const handleSaveEdit = () => {
    const parsed = parseInt(editAmount.replace(/\D/g, ''), 10);
    if (!parsed || parsed <= 0) return;

    const selectedCategory = categories.find((category) => category.id === editCategoryId);
    if (!selectedCategory || selectedCategory.isIncome !== (editType === 'income')) return;
    if (selectedCategory.isArchived && selectedCategory.id !== activeTransaction.categoryId) return;

    onUpdate(activeTransaction.id, {
      amount: parsed,
      categoryId: selectedCategory.id,
      isIncome: editType === 'income',
    });
    setKeyboardOpen(false);
    setMode('view');
  };

  const handleCloseSheet = () => {
    setKeyboardOpen(false);
    setMode('view');
    onClose();
  };

  const closeOrHideKeyboard = () => {
    if (mode === 'edit' && keyboardOpen) {
      setKeyboardOpen(false);
      return;
    }
    handleCloseSheet();
  };

  const handleDelete = () => {
    onDelete(activeTransaction.id);
    handleCloseSheet();
  };

  const handleExited = () => {
    setSnapshot(null);
    setMode('view');
    setKeyboardOpen(false);
    onExited?.();
  };

  return (
    <BottomSheet
      open={open}
      onClose={handleCloseSheet}
      onExited={handleExited}
      onEscape={closeOrHideKeyboard}
      onBackdropClick={closeOrHideKeyboard}
      onPanelClick={(event) => {
        if (mode !== 'edit' || !keyboardOpen) return;
        const target = event.target as HTMLElement;
        if (target.closest('[data-amount-trigger], [data-amount-keyboard], button, input, select, textarea')) return;
        setKeyboardOpen(false);
      }}
      ariaLabel="Детали транзакции"
      panelClassName={mode === 'edit' && keyboardOpen ? 'overflow-y-auto' : 'overflow-hidden'}
      panelStyle={{
        height: mode === 'edit' && keyboardOpen ? 'auto' : '60vh',
        maxHeight: mode === 'edit' && keyboardOpen ? '94dvh' : undefined,
      }}
    >
      <div style={{ height: mode === 'edit' && keyboardOpen ? 'auto' : 'calc(100% - 24px)' }} className={`flex flex-col px-6 ${mode === 'edit' && keyboardOpen ? 'pb-3' : 'pb-8 overflow-hidden'}`}>
        {mode === 'view' && (
          <ViewMode
            transaction={activeTransaction}
            categoryName={categoryName}
            categoryIconName={categoryIconName}
            onEdit={startEditing}
            onDelete={() => setMode('delete')}
          />
        )}

        {mode === 'edit' && (
          <EditMode
            editAmount={editAmount}
            setEditAmount={setEditAmount}
            editCategoryId={editCategoryId}
            setEditCategoryId={setEditCategoryId}
            editCategories={editCategories}
            editType={editType}
            onTypeChange={handleEditTypeChange}
            onSave={handleSaveEdit}
            onCancel={() => { setKeyboardOpen(false); setMode('view'); }}
            keyboardOpen={keyboardOpen}
            setKeyboardOpen={setKeyboardOpen}
          />
        )}

        {mode === 'delete' && (
          <DeleteMode
            transaction={activeTransaction}
            categoryName={categoryName}
            onConfirm={handleDelete}
            onCancel={() => setMode('view')}
          />
        )}
      </div>
    </BottomSheet>
  );
}

function ViewMode({
  transaction,
  categoryName,
  categoryIconName,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  categoryName: string;
  categoryIconName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
        Детали транзакции
      </h2>

      <div className="mt-5 flex flex-col items-center">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            transaction.isIncome
              ? 'bg-mint/10 dark:bg-mint/10'
              : 'bg-neutral-100 dark:bg-neutral-800/50'
          }`}
        >
          <IconRenderer
            name={categoryIconName}
            className={`h-7 w-7 ${
              transaction.isIncome ? 'text-mint dark:text-mint' : 'text-neutral-500 dark:text-neutral-400'
            }`}
          />
        </div>
        <p className="mt-3 text-3xl font-light tracking-tight text-neutral-900 dark:text-white tabular-nums">
          {transaction.isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
          <span className="ml-1 text-lg text-neutral-400 dark:text-neutral-500">₽</span>
        </p>
        <span
          className={`mt-2 flex items-center gap-1 text-xs font-medium ${
            transaction.isIncome ? 'text-mint dark:text-mint' : 'text-neutral-400 dark:text-neutral-500'
          }`}
        >
          {transaction.isIncome ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {transaction.isIncome ? 'Доход' : 'Расход'}
        </span>
      </div>

      <div className="mt-5 space-y-2.5">
        <DetailRow label="Категория" value={categoryName} />
        <DetailRow label="Дата" value={transaction.date} />
        <DetailRow label="ID" value={`#${transaction.id}`} />
      </div>

      <div className="flex-1" />

      <div className="flex gap-2.5">
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium text-neutral-700 dark:text-white neu-card-sm transition-all duration-200 active:scale-[0.98] gpu"
        >
          <Pencil className="h-4 w-4" />
          Изменить
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-medium text-red-500 dark:text-red-400 transition-all duration-200 active:scale-[0.98] gpu"
          style={{ background: 'rgba(239, 68, 68, 0.08)' }}
          aria-label="Удалить"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl neu-inset px-4 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {label}
      </span>
      <span className="text-sm font-medium text-neutral-900 dark:text-white">{value}</span>
    </div>
  );
}

function EditMode({
  editAmount,
  setEditAmount,
  editCategoryId,
  setEditCategoryId,
  editCategories,
  editType,
  onTypeChange,
  onSave,
  onCancel,
  keyboardOpen,
  setKeyboardOpen,
}: {
  editAmount: string;
  setEditAmount: (value: string) => void;
  editCategoryId: string;
  setEditCategoryId: (categoryId: string) => void;
  editCategories: CustomCategory[];
  editType: TxType;
  onTypeChange: (type: TxType) => void;
  onSave: () => void;
  onCancel: () => void;
  keyboardOpen: boolean;
  setKeyboardOpen: (open: boolean) => void;
}) {
  const parsedAmount = parseInt(editAmount.replace(/\D/g, ''), 10);
  const hasSelection = editCategories.some((category) => category.id === editCategoryId);

  return (
    <div className={`flex min-h-0 flex-col ${keyboardOpen ? 'overflow-visible' : 'h-full'}`}>
      <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
        Редактировать
      </h2>
      {!keyboardOpen && (
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          Измените тип, сумму и категорию
        </p>
      )}

      <div className={`${keyboardOpen ? 'mt-3' : 'mt-4'} flex shrink-0 gap-2`}>
        {(['expense', 'income'] as const).map((type) => (
          <button
            key={type}
            onClick={() => onTypeChange(type)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-all duration-200 active:scale-95 gpu ${
              editType === type
                ? type === 'income'
                  ? 'bg-mint/15 text-mint dark:bg-mint/15 dark:text-mint'
                  : 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                : 'neu-inset text-neutral-400 dark:text-neutral-500'
            }`}
          >
            {type === 'income' ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {type === 'income' ? 'Доход' : 'Расход'}
          </button>
        ))}
      </div>

      <div className={`${keyboardOpen ? 'mt-3' : 'mt-5'} flex shrink-0 flex-col items-center`}>
        <div className="flex w-full items-baseline justify-center">
          <AmountTrigger
            value={editAmount}
            onChange={setEditAmount}
            keyboardOpen={keyboardOpen}
            onToggleKeyboard={() => setKeyboardOpen(!keyboardOpen)}
            onOpenKeyboard={() => setKeyboardOpen(true)}
            onCloseKeyboard={() => setKeyboardOpen(false)}
            label="Сумма редактируемой транзакции в рублях"
            keyboardId="edit-transaction-amount-keyboard"
            size="medium"
          />
        </div>
      </div>

      {!keyboardOpen && <div className="mt-5 min-h-0 flex-1">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Категория
        </p>
        {editCategories.length === 0 ? (
          <p className="rounded-xl neu-inset p-3 text-xs text-neutral-400 dark:text-neutral-500">
            Для этого типа пока нет доступных категорий. Добавьте категорию через форму новой транзакции.
          </p>
        ) : (
          <div className="grid max-h-[150px] grid-cols-3 gap-2 overflow-y-auto no-scrollbar p-1">
            {editCategories.map((category) => {
              const active = editCategoryId === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => setEditCategoryId(category.id)}
                  className={`flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-3 transition-all duration-200 active:scale-95 gpu ${
                    active ? 'neu-card-sm ring-1 ring-mint/40 dark:ring-mint/30' : 'neu-inset'
                  }`}
                >
                  <IconRenderer
                    name={category.iconName}
                    className={`h-5 w-5 ${
                      active ? 'text-mint dark:text-mint' : 'text-neutral-400 dark:text-neutral-500'
                    }`}
                  />
                  <span className={`max-w-full truncate text-[11px] font-medium ${
                    active ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-500'
                  }`}>
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>}

      {keyboardOpen && (
        <div className="mt-4 flex min-h-0 flex-col gap-2.5">
          <div className="flex shrink-0 gap-2.5">
            <button
              onClick={onCancel}
              className="flex-1 rounded-2xl py-3 text-sm font-medium text-neutral-500 neu-card-sm transition-all duration-200 active:scale-[0.98] gpu dark:text-neutral-400"
            >
              Отмена
            </button>
            <button
              onClick={onSave}
              disabled={!parsedAmount || parsedAmount <= 0 || !hasSelection}
              className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              Сохранить
            </button>
          </div>
          <AmountKeyboard
            id="edit-transaction-amount-keyboard"
            value={editAmount}
            onChange={setEditAmount}
            onClose={() => setKeyboardOpen(false)}
            label="Клавиатура суммы редактируемой транзакции"
            replaceOnFirstDigit
          />
        </div>
      )}

      {!keyboardOpen && <div className="flex-1" />}

      {!keyboardOpen && <div className="flex gap-2.5 pt-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-2xl py-3.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 neu-card-sm transition-all duration-200 active:scale-[0.98] gpu"
        >
          Отмена
        </button>
        <button
          onClick={onSave}
          disabled={!parsedAmount || parsedAmount <= 0 || !hasSelection}
          className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          Сохранить
        </button>
      </div>}
    </div>
  );
}

function DeleteMode({
  transaction,
  categoryName,
  onConfirm,
  onCancel,
}: {
  transaction: Transaction;
  categoryName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <DeleteConfirmationPanel
      title="Удалить транзакцию?"
      description={`«${categoryName}» на ${formatCurrency(transaction.amount)} ₽ будет удалена без возможности восстановления.`}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
