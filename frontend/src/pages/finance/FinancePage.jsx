import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiTrendingUp, FiArrowDownLeft, FiArrowUpRight, FiDollarSign, 
  FiPercent, FiCreditCard, FiFolder, FiBriefcase, FiBookOpen, 
  FiPlus, FiX, FiCheckCircle, FiActivity, FiLayers
} from 'react-icons/fi';
import apiClient from '../../api/client';
import { formatINR } from '../../utils/format';
import toast from 'react-hot-toast';

export default function FinancePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddVoucherOpen, setIsAddVoucherOpen] = useState(false);
  const [voucherType, setVoucherType] = useState('Expense'); // Expense, Journal, Contra, Payment

  // Forms States
  const [accountForm, setAccountForm] = useState({ account_name: '', account_type: 'Asset', account_code: '', opening_balance: 0 });
  const [expenseForm, setExpenseForm] = useState({ category_id: '', amount: '', notes: '', payment_method: 'Cash', paid_to: '' });
  const [journalForm, setJournalForm] = useState({ description: '', debit_account: '', credit_account: '', amount: '' });
  const [contraForm, setContraForm] = useState({ from_type: 'Cash', from_id: '', to_type: 'Bank', to_id: '', amount: '', notes: '' });

  // --- Queries ---
  const { data: invoicesResponse, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['finance-invoices'],
    queryFn: async () => {
      const response = await apiClient.get('/invoices');
      return response.data;
    }
  });
  const invoices = invoicesResponse?.data || [];

  const { data: suppliersResponse, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: ['finance-suppliers'],
    queryFn: async () => {
      const response = await apiClient.get('/suppliers');
      return response.data;
    }
  });
  const suppliers = suppliersResponse?.data || [];

  const { data: accountsResponse } = useQuery({
    queryKey: ['finance-accounts'],
    queryFn: async () => {
      const response = await apiClient.get('/finance/accounts');
      return response.data;
    }
  });
  const accounts = accountsResponse?.data || [];

  const { data: expensesResponse } = useQuery({
    queryKey: ['finance-expenses'],
    queryFn: async () => {
      const response = await apiClient.get('/finance/expenses');
      return response.data;
    }
  });
  const expenses = expensesResponse?.data || [];

  const { data: cashAccountsResponse } = useQuery({
    queryKey: ['finance-cash'],
    queryFn: async () => {
      const response = await apiClient.get('/finance/cash-accounts');
      return response.data;
    }
  });
  const cashAccounts = cashAccountsResponse?.data || [];

  const { data: bankAccountsResponse } = useQuery({
    queryKey: ['finance-bank'],
    queryFn: async () => {
      const response = await apiClient.get('/finance/bank-accounts');
      return response.data;
    }
  });
  const bankAccounts = bankAccountsResponse?.data || [];

  // --- Mutations ---
  const createAccountMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/finance/accounts', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Chart of account added successfully!');
      setIsAddAccountOpen(false);
      queryClient.invalidateQueries({ queryKey: ['finance-accounts'] });
    }
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/finance/expenses', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Expense voucher created!');
      setIsAddVoucherOpen(false);
      queryClient.invalidateQueries({ queryKey: ['finance-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-invoices'] });
    }
  });

  const createJournalMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/finance/journal-entries', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Journal entry posted successfully!');
      setIsAddVoucherOpen(false);
    }
  });

  const createContraMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiClient.post('/finance/contra-entries', payload);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Contra bank/cash transfer recorded!');
      setIsAddVoucherOpen(false);
      queryClient.invalidateQueries({ queryKey: ['finance-cash'] });
      queryClient.invalidateQueries({ queryKey: ['finance-bank'] });
    }
  });

  // Calculations
  const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.net_amount || 0), 0);
  const totalReceivable = invoices.filter(inv => inv.payment_status !== 'Paid').reduce((sum, inv) => sum + parseFloat(inv.net_amount || 0), 0);
  const totalPayable = suppliers.reduce((sum, s) => sum + parseFloat(s.credit_limit || 0), 0);
  const totalGST = invoices.reduce((sum, inv) => sum + parseFloat(inv.cgst_amount || 0) + parseFloat(inv.sgst_amount || 0), 0);

  const handleAccountSubmit = (e) => {
    e.preventDefault();
    createAccountMutation.mutate(accountForm);
  };

  const handleVoucherSubmit = (e) => {
    e.preventDefault();
    if (voucherType === 'Expense') {
      createExpenseMutation.mutate({
        amount: parseFloat(expenseForm.amount),
        notes: expenseForm.notes,
        payment_method: expenseForm.payment_method,
        paid_to: expenseForm.paid_to
      });
    } else if (voucherType === 'Journal') {
      createJournalMutation.mutate({
        description: journalForm.description,
        total_debit: parseFloat(journalForm.amount),
        total_credit: parseFloat(journalForm.amount),
        lines: [
          { account_id: parseInt(journalForm.debit_account), debit: parseFloat(journalForm.amount), credit: 0 },
          { account_id: parseInt(journalForm.credit_account), debit: 0, credit: parseFloat(journalForm.amount) }
        ]
      });
    } else if (voucherType === 'Contra') {
      createContraMutation.mutate({
        from_account_type: contraForm.from_type,
        from_account_id: parseInt(contraForm.from_id),
        to_account_type: contraForm.to_type,
        to_account_id: parseInt(contraForm.to_id),
        amount: parseFloat(contraForm.amount),
        notes: contraForm.notes
      });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* Header section with Emerald-Indigo Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Financial Treasury</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-xl">
              Consolidated workspace for Charts of Accounts, Cash & Bank ledgers, Journals, and Expense Vouchers.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsAddAccountOpen(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 text-sm flex items-center gap-1.5"
            >
              <FiPlus />
              Add Account
            </button>
            <button
              onClick={() => setIsAddVoucherOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold rounded-xl shadow-lg text-sm flex items-center gap-1.5"
            >
              <FiPlus />
              Create Voucher
            </button>
          </div>
        </div>
      </div>

      {/* Navigation tabs for consolidation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-sm">
        {[
          { id: 'dashboard', label: 'Overview Dashboard', icon: FiActivity },
          { id: 'accounts', label: 'Chart of Accounts', icon: FiLayers },
          { id: 'cashbank', label: 'Cash & Bank Tills', icon: FiBookOpen },
          { id: 'vouchers', label: 'Transaction Vouchers', icon: FiBriefcase }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 pb-4 font-semibold border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <tab.icon />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { title: 'Total Revenue', value: formatINR(totalRevenue), subtitle: 'All sales & operations', icon: FiTrendingUp, color: 'from-emerald-500 to-teal-600' },
                { title: 'Receivables', value: formatINR(totalReceivable), subtitle: 'Outstanding invoices', icon: FiArrowDownLeft, color: 'from-blue-500 to-indigo-600' },
                { title: 'Payables', value: formatINR(totalPayable), subtitle: 'Vendor credits', icon: FiArrowUpRight, color: 'from-rose-500 to-orange-600' },
                { title: 'GST Liability', value: formatINR(totalGST), subtitle: 'Net collected duties', icon: FiPercent, color: 'from-violet-500 to-purple-700' }
              ].map((stat) => (
                <div key={stat.title} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-xl flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{stat.title}</span>
                    <h3 className="text-2xl font-black text-slate-950 dark:text-white mt-1">{stat.value}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{stat.subtitle}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-md`}>
                    <stat.icon className="text-lg" />
                  </div>
                </div>
              ))}
            </div>

            {/* Sub-widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-6 lg:col-span-1">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FiCreditCard className="text-indigo-500" />
                  Collections Mix
                </h3>
                <div className="space-y-4">
                  {[
                    { name: 'Cash', amount: invoices.filter(i => i.payment_method === 'Cash').reduce((sum, i) => sum + parseFloat(i.net_amount || 0), 0), color: 'bg-emerald-500' },
                    { name: 'UPI / NEFT', amount: invoices.filter(i => i.payment_method === 'UPI').reduce((sum, i) => sum + parseFloat(i.net_amount || 0), 0), color: 'bg-indigo-500' },
                    { name: 'Card Settlements', amount: invoices.filter(i => i.payment_method === 'Card').reduce((sum, i) => sum + parseFloat(i.net_amount || 0), 0), color: 'bg-violet-500' }
                  ].map(channel => {
                    const pct = totalRevenue > 0 ? (channel.amount / totalRevenue) * 100 : 0;
                    return (
                      <div key={channel.name} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-400">{channel.name}</span>
                          <span className="text-slate-200">{formatINR(channel.amount)} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${channel.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4 lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FiActivity className="text-indigo-500" />
                  Recent Ledger Entries
                </h3>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                        <th className="py-2.5">Doc ID</th>
                        <th className="py-2.5">Date</th>
                        <th className="py-2.5">Particulars</th>
                        <th className="py-2.5 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 text-slate-300">
                      {invoices.slice(0, 4).map(inv => (
                        <tr key={inv.id}>
                          <td className="py-3 font-mono text-indigo-600 dark:text-indigo-400">{inv.invoice_number}</td>
                          <td className="py-3">{new Date(inv.invoice_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                          <td className="py-3 font-medium">Invoice Posting ({inv.payment_method})</td>
                          <td className="py-3 text-right font-bold text-slate-900 dark:text-white">{formatINR(inv.net_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">General Chart of Accounts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {['Asset', 'Liability', 'Equity', 'Income', 'Expense'].map(type => (
                <div key={type} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
                  <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 border-b border-slate-200 dark:border-slate-800/80 pb-2 uppercase tracking-wide">{type} Accounts</h4>
                  <div className="space-y-2 text-xs">
                    {accounts.filter(a => a.account_type === type).map(acc => (
                      <div key={acc.id} className="flex justify-between items-center p-2 bg-white dark:bg-slate-900/40 rounded border border-slate-200 dark:border-slate-800/40 shadow-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{acc.account_name}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">{formatINR(acc.current_balance)}</span>
                      </div>
                    ))}
                    {accounts.filter(a => a.account_type === type).length === 0 && (
                      <span className="text-slate-400 dark:text-slate-600 block text-center py-4">No accounts mapped</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cashbank' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cash accounts */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
              <h3 className="text-base font-bold text-slate-950 dark:text-white uppercase tracking-wider text-indigo-400">Cash Counters / Tills</h3>
              <div className="space-y-3 text-xs">
                {cashAccounts.map(c => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                    <div>
                      <span className="font-bold text-slate-200 text-sm block">{c.name}</span>
                      <span className="text-slate-500">Opening: {formatINR(c.opening_balance)}</span>
                    </div>
                    <span className="text-base font-black text-emerald-400">{formatINR(c.current_balance)}</span>
                  </div>
                ))}
                {cashAccounts.length === 0 && (
                  <div className="py-6 text-center text-slate-500">No cash accounts registered.</div>
                )}
              </div>
            </div>
            {/* Bank accounts */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
              <h3 className="text-base font-bold text-slate-950 dark:text-white uppercase tracking-wider text-indigo-400">Bank Accounts & Ledgers</h3>
              <div className="space-y-3 text-xs">
                {bankAccounts.map(b => (
                  <div key={b.id} className="flex justify-between items-center p-3 bg-slate-950/40 border border-slate-800 rounded-xl">
                    <div>
                      <span className="font-bold text-slate-200 text-sm block">{b.account_name}</span>
                      <span className="text-slate-500">{b.bank_name} — {b.account_number}</span>
                    </div>
                    <span className="text-base font-black text-indigo-400">{formatINR(b.current_balance)}</span>
                  </div>
                ))}
                {bankAccounts.length === 0 && (
                  <div className="py-6 text-center text-slate-500">No bank accounts registered.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vouchers' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">Recent Operating Expenses</h3>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-semibold">
                    <th className="py-2.5">Voucher Code</th>
                    <th className="py-2.5">Date</th>
                    <th className="py-2.5">Payment Mode</th>
                    <th className="py-2.5">Notes</th>
                    <th className="py-2.5 text-right">Net Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {expenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-3 font-mono text-indigo-600 dark:text-indigo-400">{exp.expense_number}</td>
                      <td className="py-3">{new Date(exp.expense_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td className="py-3">{exp.payment_method}</td>
                      <td className="py-3 max-w-[200px] truncate">{exp.notes || 'N/A'}</td>
                      <td className="py-3 text-right font-bold text-slate-900 dark:text-white">{formatINR(exp.amount)}</td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">No expenses recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ADD ACCOUNT MODAL */}
      <AnimatePresence>
        {isAddAccountOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsAddAccountOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white">Create New Ledger Account</h3>
                <button onClick={() => setIsAddAccountOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>
              <form onSubmit={handleAccountSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Account Code</label>
                  <input
                    required
                    type="text"
                    value={accountForm.account_code}
                    onChange={(e) => setAccountForm({ ...accountForm, account_code: e.target.value })}
                    placeholder="e.g. 1010-CASH"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Account Name</label>
                  <input
                    required
                    type="text"
                    value={accountForm.account_name}
                    onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                    placeholder="e.g. Petty Cash Account"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Type</label>
                    <select
                      value={accountForm.account_type}
                      onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      {['Asset', 'Liability', 'Equity', 'Income', 'Expense'].map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Opening Balance</label>
                    <input
                      type="number"
                      value={accountForm.opening_balance}
                      onChange={(e) => setAccountForm({ ...accountForm, opening_balance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm mt-4"
                >
                  Create Ledger Account
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREATE VOUCHER MODAL */}
      <AnimatePresence>
        {isAddVoucherOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setIsAddVoucherOpen(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 z-10 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <div className="flex gap-2">
                  {['Expense', 'Journal', 'Contra'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setVoucherType(type)}
                      className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                        voucherType === type ? 'bg-indigo-600 text-white' : 'bg-slate-850 text-slate-400 hover:text-white'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                <button onClick={() => setIsAddVoucherOpen(false)} className="text-slate-400 hover:text-white"><FiX /></button>
              </div>

              <form onSubmit={handleVoucherSubmit} className="space-y-4">
                
                {voucherType === 'Expense' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Paid To</label>
                      <input
                        required
                        type="text"
                        value={expenseForm.paid_to}
                        onChange={(e) => setExpenseForm({ ...expenseForm, paid_to: e.target.value })}
                        placeholder="Recipient Name"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Amount</label>
                        <input
                          required
                          type="number"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                          placeholder="INR"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Method</label>
                        <select
                          value={expenseForm.payment_method}
                          onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Cash">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="BankTransfer">Bank Transfer</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Notes</label>
                      <input
                        type="text"
                        value={expenseForm.notes}
                        onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                        placeholder="Voucher details"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </>
                )}

                {voucherType === 'Journal' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Debit Account (Dr)</label>
                        <select
                          required
                          value={journalForm.debit_account}
                          onChange={(e) => setJournalForm({ ...journalForm, debit_account: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">-- Choose Account --</option>
                          {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Credit Account (Cr)</label>
                        <select
                          required
                          value={journalForm.credit_account}
                          onChange={(e) => setJournalForm({ ...journalForm, credit_account: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">-- Choose Account --</option>
                          {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.account_name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Total Transaction Amount</label>
                      <input
                        required
                        type="number"
                        value={journalForm.amount}
                        onChange={(e) => setJournalForm({ ...journalForm, amount: e.target.value })}
                        placeholder="Double entry amount"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Description</label>
                      <input
                        type="text"
                        value={journalForm.description}
                        onChange={(e) => setJournalForm({ ...journalForm, description: e.target.value })}
                        placeholder="Journal memo"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </>
                )}

                {voucherType === 'Contra' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">From Account Type</label>
                        <select
                          value={contraForm.from_type}
                          onChange={(e) => setContraForm({ ...contraForm, from_type: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                        >
                          <option value="Cash">Cash Account</option>
                          <option value="Bank">Bank Account</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">From Source ID</label>
                        <select
                          required
                          value={contraForm.from_id}
                          onChange={(e) => setContraForm({ ...contraForm, from_id: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                        >
                          <option value="">-- Select Source --</option>
                          {contraForm.from_type === 'Cash' 
                            ? cashAccounts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                            : bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)
                          }
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">To Account Type</label>
                        <select
                          value={contraForm.to_type}
                          onChange={(e) => setContraForm({ ...contraForm, to_type: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                        >
                          <option value="Bank">Bank Account</option>
                          <option value="Cash">Cash Account</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">To Destination ID</label>
                        <select
                          required
                          value={contraForm.to_id}
                          onChange={(e) => setContraForm({ ...contraForm, to_id: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                        >
                          <option value="">-- Select Destination --</option>
                          {contraForm.to_type === 'Cash' 
                            ? cashAccounts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                            : bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)
                          }
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Transfer Amount</label>
                      <input
                        required
                        type="number"
                        value={contraForm.amount}
                        onChange={(e) => setContraForm({ ...contraForm, amount: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold rounded-xl shadow-lg text-sm mt-4"
                >
                  Post Voucher / Transaction
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
