import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DollarSign,
  Upload,
  TrendingDown,
  TrendingUp,
  Wallet,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Plus,
  Landmark,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { FadeIn } from '../../shared/components/ui/AnimatedComponents';
import {
  useFinanceStore,
  FINANCE_CATEGORIES,
  formatCents,
  shiftMonth,
  currentMonth,
  type FinanceTransaction,
} from '../../store/financeStore';

const CATEGORY_COLORS: Record<string, string> = {
  groceries: '#4ECDC4',
  dining: '#FF6B6B',
  transport: '#FFA94D',
  shopping: '#A335EE',
  subscriptions: '#0070DD',
  utilities: '#74C0FC',
  entertainment: '#F783AC',
  health: '#69DB7C',
  fitness: '#38D9A9',
  travel: '#FFD43B',
  home: '#E599F7',
  rent: '#FF8787',
  income: '#51CF66',
  transfers: '#868E96',
  investing: '#9775FA',
  fees: '#FAB005',
  other: '#CED4DA',
  uncategorized: '#5C6370',
};

const categoryColor = (category: string): string =>
  CATEGORY_COLORS[category] ?? '#5C6370';

const formatMonthLabel = (month: string): string => {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

const shortMonthLabel = (month: string): string => {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
};

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: string;
}

const SummaryCard = ({ label, value, icon: Icon, accent }: SummaryCardProps) => (
  <div className="bg-theme-primary border border-gray-800 rounded-lg p-5 flex items-center gap-4">
    <div className={`p-3 rounded-lg bg-theme-bg ${accent}`}>
      <Icon className="w-6 h-6" />
    </div>
    <div className="min-w-0">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-xl font-bold truncate">{value}</p>
    </div>
  </div>
);

const TransactionRow = ({ txn }: { txn: FinanceTransaction }) => {
  const { setCategory } = useFinanceStore();
  const [always, setAlways] = useState(false);

  return (
    <tr className="border-b border-gray-800/60 hover:bg-theme-bg/60 transition-colors">
      <td className="py-2.5 px-3 text-sm text-gray-400 whitespace-nowrap">{txn.date}</td>
      <td className="py-2.5 px-3">
        <p className="text-sm font-medium truncate max-w-[220px]" title={txn.merchant}>
          {txn.merchant}
        </p>
        <p className="text-xs text-gray-500 truncate max-w-[220px]">{txn.account_name}</p>
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: categoryColor(txn.category) }}
          />
          <select
            value={txn.category}
            onChange={(e) => void setCategory(txn.id, e.target.value, always)}
            className="bg-theme-bg border border-gray-700 rounded px-2 py-1 text-xs text-theme-fg focus:border-solo-accent focus:outline-none"
          >
            {FINANCE_CATEGORIES.includes(txn.category as (typeof FINANCE_CATEGORIES)[number]) ? null : (
              <option value={txn.category}>{txn.category}</option>
            )}
            {FINANCE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <label
            className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none"
            title="Always categorize this merchant this way (creates a rule)"
          >
            <input
              type="checkbox"
              checked={always}
              onChange={(e) => setAlways(e.target.checked)}
              className="accent-purple-500"
            />
            always
          </label>
        </div>
      </td>
      <td
        className={`py-2.5 px-3 text-right text-sm font-semibold whitespace-nowrap ${
          txn.amount_cents < 0 ? 'text-red-400' : 'text-green-400'
        }`}
      >
        {formatCents(txn.amount_cents)}
      </td>
    </tr>
  );
};

const Finance = () => {
  const {
    accounts,
    transactions,
    summary,
    monthlyTotals,
    selectedMonth,
    loading,
    importing,
    lastImport,
    error,
    setMonth,
    fetchAccounts,
    createAccount,
    importCsv,
    refresh,
  } = useFinanceStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importAccountId, setImportAccountId] = useState<number | null>(null);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountKind, setNewAccountKind] = useState('bank');

  useEffect(() => {
    void fetchAccounts();
    void refresh();
  }, [fetchAccounts, refresh]);

  useEffect(() => {
    if (importAccountId === null && accounts.length > 0) {
      setImportAccountId(accounts[0].id);
    }
  }, [accounts, importAccountId]);

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file || importAccountId === null) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (content) {
        void importCsv(importAccountId, content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    try {
      await createAccount(newAccountName.trim(), newAccountKind);
      setNewAccountName('');
      setShowNewAccount(false);
    } catch {
      // error already surfaced via store.error
    }
  };

  const donutData = useMemo(
    () =>
      (summary?.by_category ?? []).map((c) => ({
        name: c.category,
        value: c.spent_cents / 100,
      })),
    [summary],
  );

  const barData = useMemo(
    () =>
      monthlyTotals.map((m) => ({
        month: shortMonthLabel(m.month),
        Spent: Math.round(m.spent_cents) / 100,
        Income: Math.round(m.income_cents) / 100,
      })),
    [monthlyTotals],
  );

  const isCurrentMonth = selectedMonth >= currentMonth();

  // Accounts with a live balance (populated by SimpleFIN sync).
  const accountsWithBalance = accounts.filter((a) => a.balance_cents != null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-theme-accent" />
              Finance
            </h1>
            <p className="text-gray-400">Track spending from your bank and Robinhood statements</p>
          </div>
          <div className="flex items-center gap-2 bg-theme-primary border border-gray-800 rounded-lg px-2 py-1.5">
            <button
              onClick={() => setMonth(shiftMonth(selectedMonth, -1))}
              className="p-1.5 rounded hover:bg-theme-bg text-gray-400 hover:text-theme-fg transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold w-36 text-center">
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              onClick={() => setMonth(shiftMonth(selectedMonth, 1))}
              disabled={isCurrentMonth}
              className="p-1.5 rounded hover:bg-theme-bg text-gray-400 hover:text-theme-fg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </FadeIn>

      {/* Import bar */}
      <div className="bg-theme-primary border border-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Landmark className="w-5 h-5 text-theme-accent flex-shrink-0" />
          <select
            value={importAccountId ?? ''}
            onChange={(e) => setImportAccountId(Number(e.target.value))}
            className="bg-theme-bg border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-solo-accent focus:outline-none"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.kind})
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowNewAccount((v) => !v)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:text-theme-fg hover:bg-theme-bg transition-colors"
          >
            <Plus className="w-4 h-4" /> Account
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || importAccountId === null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-solo-accent/20 text-theme-accent border border-solo-accent/40 hover:bg-solo-accent/30 transition-colors text-sm font-semibold disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <span className="text-xs text-gray-500">
            Chase, Bank of America, Amex &amp; Robinhood exports auto-detected
          </span>
        </div>

        {showNewAccount && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreateAccount();
              }}
              placeholder="Account name (e.g. Chase Sapphire)"
              className="bg-theme-bg border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-solo-accent focus:outline-none w-64"
            />
            <select
              value={newAccountKind}
              onChange={(e) => setNewAccountKind(e.target.value)}
              className="bg-theme-bg border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-solo-accent focus:outline-none"
            >
              <option value="bank">bank</option>
              <option value="credit">credit</option>
              <option value="brokerage">brokerage</option>
            </select>
            <button
              onClick={() => void handleCreateAccount()}
              className="px-3 py-2 rounded-lg bg-solo-accent/20 text-theme-accent border border-solo-accent/40 text-sm hover:bg-solo-accent/30 transition-colors"
            >
              Create
            </button>
          </div>
        )}

        {lastImport && (
          <p className="mt-3 text-xs text-gray-400">
            Last import ({lastImport.detected_format}): {lastImport.imported} added,{' '}
            {lastImport.duplicates} duplicates skipped of {lastImport.total_rows} rows.
          </p>
        )}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </div>

      {/* Live account balances (SimpleFIN-synced accounts) */}
      {accountsWithBalance.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {accountsWithBalance.map((account) => (
            <div
              key={account.id}
              className="bg-theme-primary border border-gray-800 rounded-lg p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" title={account.name}>
                  {account.name}
                </p>
                <p className="text-xs text-gray-500 capitalize">{account.kind} · live balance</p>
              </div>
              <p
                className={`text-lg font-bold whitespace-nowrap ${
                  (account.balance_cents ?? 0) < 0 ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {formatCents(account.balance_cents ?? 0)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Spent"
          value={formatCents(-(summary?.spent_cents ?? 0))}
          icon={TrendingDown}
          accent="text-red-400"
        />
        <SummaryCard
          label="Income"
          value={formatCents(summary?.income_cents ?? 0)}
          icon={TrendingUp}
          accent="text-green-400"
        />
        <SummaryCard
          label="Net"
          value={formatCents(summary?.net_cents ?? 0)}
          icon={Wallet}
          accent={(summary?.net_cents ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <SummaryCard
          label="Transactions"
          value={String(summary?.transaction_count ?? 0)}
          icon={Receipt}
          accent="text-theme-accent"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-theme-primary border border-gray-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-4">Spending by Category</h2>
          {donutData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-500">
              No spending recorded for {formatMonthLabel(selectedMonth)}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="none"
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={categoryColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#e5e7eb',
                  }}
                  formatter={(value: number, name: string) => [
                    `$${Number(value).toFixed(2)}`,
                    name,
                  ]}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-400">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-theme-primary border border-gray-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-4">Month over Month</h2>
          {barData.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-sm text-gray-500">
              Import a statement to see trends
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a2e',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#e5e7eb',
                  }}
                  formatter={(value: number, name: string) => [
                    `$${Number(value).toFixed(2)}`,
                    name,
                  ]}
                />
                <Legend />
                <Bar dataKey="Spent" fill="#FF6B6B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Income" fill="#51CF66" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-theme-primary border border-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Transactions — {formatMonthLabel(selectedMonth)}</h2>
          {loading && <span className="text-xs text-gray-500">Loading…</span>}
        </div>
        {transactions.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No transactions this month. Import a CSV statement to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-gray-500 border-b border-gray-800">
                  <th className="py-2 px-3 font-medium">Date</th>
                  <th className="py-2 px-3 font-medium">Merchant</th>
                  <th className="py-2 px-3 font-medium">Category</th>
                  <th className="py-2 px-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Finance;
