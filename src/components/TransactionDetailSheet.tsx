import { useState, useEffect } from 'react';
import {
  X,
  Eye,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  AlertTriangle,
  Utensils,
  Car,
  Home,
} from 'lucide-react';
import { formatCurrency, getIconForCategory, type Transaction } from '@/data/mockData';

type TxType = 'expense' | 'income';
type Category = 'Еда' | 'Транспорт' | 'Аренда';

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  onClose: () => void;
  onUpdate: (id: number, updates: { amount: number; category: string; isIncome: boolean }) => void;
  onDelete: (id: number) => void;
}

const editCategories: { label: Category; icon: typeof Utensils }[] = [
  { label: 'Еда', icon: Utensils },
  { label: 'Транспорт', icon: Car },
  { label: 'Аренда', icon: Home },
];

export function TransactionDetailSheet({
  transaction,
  onClose,
  onUpdate,
  onDelete,
}: TransactionDetailSheetProps) {
  const open = transaction !== null;
  const [mode, setMode] = useState<'view' | 'edit' | 'delete'>('view');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('Еда');
  const [editType, setEditType] = useState<TxType>('expense');

  useEffect(() => {
    if (transaction) {
      setMode('view');
      setEditAmount(String(transaction.amount));
      setEditCategory(
        (['Еда', 'Транспорт', 'Аренда'] as Category[]).includes(transaction.category as Category)
          ? (transaction.category as Category)
          : 'Еда'
      );
      setEditType(transaction.isIncome ? 'income' : 'expense');
    }
  }, [transaction]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!transaction) return null;

  const Icon = getIconForCategory(transaction.category);

  const handleSaveEdit = () => {
    const parsed = parseInt(editAmount.replace(/\D/g, ''), 10);
    if (!parsed || parsed <= 0) return;
    onUpdate(transaction.id, {
      amount: parsed,
      category: editCategory,
      isIncome: editType === 'income',
    });
    setMode('view');
  };

  const handleDelete = () => {
    onDelete(transaction.id);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] transition-opacity duration-300 gpu ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[70] mx-auto max-w-md rounded-t-3xl sheet-glass transition-all duration-300 ease-out gpu ${
          open
            ? 'translate-y-0 pointer-events-auto opacity-100'
            : 'translate-y-full pointer-events-none opacity-0'
        }`}
        style={{ height: '60vh' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full neu-inset transition-transform active:scale-90 gpu"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        </button>

        <div className="flex h-full flex-col px-6 pb-8">
          {mode === 'view' && (
            <ViewMode
              transaction={transaction}
              Icon={Icon}
              onEdit={() => setMode('edit')}
              onDelete={() => setMode('delete')}
            />
          )}

          {mode === 'edit' && (
            <EditMode
              editAmount={editAmount}
              setEditAmount={setEditAmount}
              editCategory={editCategory}
              setEditCategory={setEditCategory}
              editType={editType}
              setEditType={setEditType}
              onSave={handleSaveEdit}
              onCancel={() => setMode('view')}
            />
          )}

          {mode === 'delete' && (
            <DeleteMode
              transaction={transaction}
              onConfirm={handleDelete}
              onCancel={() => setMode('view')}
            />
          )}
        </div>
      </div>
    </>
  );
}

function ViewMode({
  transaction,
  Icon,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  Icon: typeof Eye;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      {/* Title */}
      <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
        Детали транзакции
      </h2>

      {/* Transaction icon + amount */}
      <div className="mt-5 flex flex-col items-center">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
            transaction.isIncome
              ? 'bg-mint/10 dark:bg-mint/10'
              : 'bg-neutral-100 dark:bg-neutral-800/50'
          }`}
        >
          <Icon
            className={`h-7 w-7 ${
              transaction.isIncome ? 'text-mint dark:text-mint' : 'text-neutral-500 dark:text-neutral-400'
            }`}
            strokeWidth={2}
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

      {/* Details grid */}
      <div className="mt-5 space-y-2.5">
        <DetailRow label="Категория" value={transaction.category} />
        <DetailRow label="Дата" value={transaction.date} />
        <DetailRow label="ID" value={`#${transaction.id}`} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Action buttons */}
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
  editCategory,
  setEditCategory,
  editType,
  setEditType,
  onSave,
  onCancel,
}: {
  editAmount: string;
  setEditAmount: (v: string) => void;
  editCategory: Category;
  setEditCategory: (c: Category) => void;
  editType: TxType;
  setEditType: (t: TxType) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <h2 className="mt-2 text-lg font-semibold text-neutral-900 dark:text-white">
        Редактировать
      </h2>
      <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
        Измените тип, сумму и категорию
      </p>

      {/* Type toggle */}
      <div className="mt-4 flex gap-2">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setEditType(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium transition-all duration-200 active:scale-95 gpu ${
              editType === t
                ? t === 'income'
                  ? 'bg-mint/15 text-mint dark:bg-mint/15 dark:text-mint'
                  : 'bg-neutral-900 text-white dark:bg-white dark:text-black'
                : 'neu-inset text-neutral-400 dark:text-neutral-500'
            }`}
          >
            {t === 'income' ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {t === 'income' ? 'Доход' : 'Расход'}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div className="mt-5 flex flex-col items-center">
        <div className="flex items-baseline justify-center">
          <input
            type="text"
            inputMode="numeric"
            value={editAmount ? formatCurrency(parseInt(editAmount.replace(/\D/g, ''), 10)) : ''}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '');
              setEditAmount(digits.slice(0, 9));
            }}
            placeholder="0"
            className="w-full bg-transparent text-center font-light tracking-tight text-4xl text-neutral-900 dark:text-white tabular-nums outline-none placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
          />
          <span className="ml-1 text-xl font-light text-neutral-400 dark:text-neutral-500">₽</span>
        </div>
      </div>

      {/* Category pills */}
      <div className="mt-5">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Категория
        </p>
        <div className="flex gap-2.5">
          {editCategories.map((cat) => {
            const Icon = cat.icon;
            const active = editCategory === cat.label;
            return (
              <button
                key={cat.label}
                onClick={() => setEditCategory(cat.label)}
                className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl py-3 transition-all duration-200 active:scale-95 gpu ${
                  active ? 'neu-card-sm ring-1 ring-mint/40 dark:ring-mint/30' : 'neu-inset'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    active ? 'text-mint dark:text-mint' : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                  strokeWidth={2}
                />
                <span
                  className={`text-[11px] font-medium ${
                    active
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-400 dark:text-neutral-500'
                  }`}
                >
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

      {/* Save / Cancel */}
      <div className="flex gap-2.5">
        <button
          onClick={onCancel}
          className="flex-1 rounded-2xl py-3.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 neu-card-sm transition-all duration-200 active:scale-[0.98] gpu"
        >
          Отмена
        </button>
        <button
          onClick={onSave}
          disabled={!editAmount || parseInt(editAmount, 10) <= 0}
          className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-mint to-indigoblue py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu disabled:opacity-40 disabled:active:scale-100"
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          Сохранить
        </button>
      </div>
    </>
  );
}

function DeleteMode({
  transaction,
  onConfirm,
  onCancel,
}: {
  transaction: Transaction;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(239, 68, 68, 0.1)' }}
        >
          <AlertTriangle className="h-8 w-8 text-red-500 dark:text-red-400" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-white">
          Удалить транзакцию?
        </h2>
        <p className="mt-1.5 text-center text-sm text-neutral-400 dark:text-neutral-500">
          «{transaction.category}» на {formatCurrency(transaction.amount)} ₽ будет удалена без возможности восстановления.
        </p>
      </div>

      <div className="flex gap-2.5">
        <button
          onClick={onCancel}
          className="flex-1 rounded-2xl py-3.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 neu-card-sm transition-all duration-200 active:scale-[0.98] gpu"
        >
          Отмена
        </button>
        <button
          onClick={onConfirm}
          className="flex flex-[2] items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] gpu"
          style={{ background: 'rgb(239 68 68)' }}
        >
          <Trash2 className="h-4 w-4" />
          Удалить
        </button>
      </div>
    </>
  );
}
