import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

export interface FinanceAccount {
  id: number;
  name: string;
  kind: 'bank' | 'credit' | 'brokerage';
  created_at?: string | null;
}

export interface FinanceTransaction {
  id: number;
  account_id: number;
  account_name: string;
  date: string; // YYYY-MM-DD
  amount_cents: number; // negative = spend, positive = income
  merchant: string;
  description?: string | null;
  category: string;
}

export interface ImportSummary {
  detected_format: string;
  total_rows: number;
  imported: number;
  duplicates: number;
  skipped: number;
}

export interface CategorySpend {
  category: string;
  spent_cents: number;
}

export interface SpendingSummary {
  month: string;
  spent_cents: number;
  income_cents: number;
  net_cents: number;
  transaction_count: number;
  by_category: CategorySpend[];
}

export interface MonthlyTotal {
  month: string; // YYYY-MM
  spent_cents: number;
  income_cents: number;
}

export const FINANCE_CATEGORIES = [
  'uncategorized',
  'groceries',
  'dining',
  'transport',
  'shopping',
  'subscriptions',
  'utilities',
  'entertainment',
  'health',
  'fitness',
  'travel',
  'home',
  'rent',
  'income',
  'transfers',
  'investing',
  'fees',
  'other',
] as const;

export const currentMonth = (): string => new Date().toISOString().slice(0, 7);

export const shiftMonth = (month: string, delta: number): string => {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const formatCents = (cents: number): string => {
  const abs = Math.abs(cents);
  const formatted = (abs / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${cents < 0 ? '-' : ''}$${formatted}`;
};

interface FinanceState {
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  summary: SpendingSummary | null;
  monthlyTotals: MonthlyTotal[];
  selectedMonth: string; // YYYY-MM
  loading: boolean;
  importing: boolean;
  lastImport: ImportSummary | null;
  error: string | null;

  setMonth: (month: string) => void;
  fetchAccounts: () => Promise<void>;
  createAccount: (name: string, kind: string) => Promise<void>;
  importCsv: (accountId: number, csvContent: string, sourceLabel: string) => Promise<ImportSummary | null>;
  refresh: () => Promise<void>;
  setCategory: (transactionId: number, category: string, createRule: boolean) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  accounts: [],
  transactions: [],
  summary: null,
  monthlyTotals: [],
  selectedMonth: currentMonth(),
  loading: false,
  importing: false,
  lastImport: null,
  error: null,

  setMonth: (month: string) => {
    set({ selectedMonth: month });
    void get().refresh();
  },

  fetchAccounts: async () => {
    try {
      const accounts = await invoke<FinanceAccount[]>('finance_get_accounts');
      set({ accounts });
    } catch (error) {
      logger.error('Failed to fetch finance accounts', error, 'FinanceStore');
      set({ error: String(error) });
    }
  },

  createAccount: async (name: string, kind: string) => {
    try {
      await invoke<FinanceAccount>('finance_create_account', { name, kind });
      await get().fetchAccounts();
      set({ error: null });
    } catch (error) {
      logger.error('Failed to create finance account', error, 'FinanceStore');
      set({ error: String(error) });
      throw error;
    }
  },

  importCsv: async (accountId: number, csvContent: string, sourceLabel: string) => {
    set({ importing: true, error: null });
    try {
      const summary = await invoke<ImportSummary>('import_transactions_csv', {
        accountId,
        csvContent,
        sourceLabel,
      });
      set({ importing: false, lastImport: summary });
      await get().refresh();
      return summary;
    } catch (error) {
      logger.error('CSV import failed', error, 'FinanceStore');
      set({ importing: false, error: String(error) });
      return null;
    }
  },

  refresh: async () => {
    const month = get().selectedMonth;
    set({ loading: true });
    try {
      const [transactions, summary, monthlyTotals] = await Promise.all([
        invoke<FinanceTransaction[]>('finance_get_transactions', { month, limit: 100 }),
        invoke<SpendingSummary>('finance_get_spending_summary', { month }),
        invoke<MonthlyTotal[]>('finance_get_monthly_totals', { months: 6 }),
      ]);
      set({ transactions, summary, monthlyTotals, loading: false, error: null });
    } catch (error) {
      logger.error('Failed to refresh finance data', error, 'FinanceStore');
      set({ loading: false, error: String(error) });
    }
  },

  setCategory: async (transactionId: number, category: string, createRule: boolean) => {
    try {
      await invoke<number>('finance_set_category', { transactionId, category, createRule });
      await get().refresh();
    } catch (error) {
      logger.error('Failed to set transaction category', error, 'FinanceStore');
      set({ error: String(error) });
    }
  },
}));
