'use client';

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Types ---
type Account = {
  id: string;
  name: string;
  balance: number;
  income: number;
  expense: number;
  iconColor: string;
  isDefault?: boolean;
};

type Category = {
  id: string;
  name: string;
  type: 'expense' | 'income';
  iconColor: string;
  iconPath: string;
};

type Subcategory = {
  id: string;
  categoryId: string;
  name: string;
};

type TransactionRecord = {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  date: string;
  accountId?: string;
  categoryId?: string;
  description: string;
  hasReminder: boolean;
  reminderTime?: string;
  isCritical?: boolean;
};

// --- Initial Data ---
const initialAccounts: Account[] = [
  { id: '1', name: 'Conta Pessoal', balance: 2500, income: 3500, expense: 1000, iconColor: 'bg-purple-500', isDefault: true },
  { id: '2', name: 'Reserva', balance: 1750, income: 1750, expense: 0, iconColor: 'bg-emerald-500' }
];

const initialCategories: Category[] = [
  { id: 'c1', name: 'Alimentação', type: 'expense', iconColor: 'text-orange-500', iconPath: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'c2', name: 'Salário', type: 'income', iconColor: 'text-blue-500', iconPath: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { id: 'c3', name: 'Lazer', type: 'expense', iconColor: 'text-pink-500', iconPath: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
  { id: 'c4', name: 'Habitação', type: 'expense', iconColor: 'text-indigo-500', iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' }
];

const initialSubcategories: Subcategory[] = [
  { id: 'sc1', categoryId: 'c1', name: 'Supermercado' },
  { id: 'sc2', categoryId: 'c1', name: 'Restaurantes' },
  { id: 'sc3', categoryId: 'c4', name: 'Aluguel' },
  { id: 'sc4', categoryId: 'c4', name: 'Luz' },
  { id: 'sc5', categoryId: 'c4', name: 'Água' },
];

const initialTransactions: TransactionRecord[] = [
  { id: 't4', type: 'expense', amount: 85, date: 'Hoje, 10:30', categoryId: 'c4', accountId: '1', description: 'Internet', hasReminder: true, reminderTime: 'at_time', isCritical: true },
  { id: 't1', type: 'income', amount: 5000, date: 'Hoje, 10:00', categoryId: 'c2', accountId: '1', description: 'Salário', hasReminder: false },
  { id: 't2', type: 'expense', amount: 750, date: 'Ontem, 19:45', categoryId: 'c1', accountId: '1', description: 'Supermercado', hasReminder: false },
  { id: 't3', type: 'expense', amount: 150, date: 'Amanhã, 14:00', categoryId: 'c4', accountId: '1', description: 'Conta de Luz', hasReminder: true, reminderTime: '24_hours' },
];

export default function Home() {
  // Navigation & Views
  const [currentView, setCurrentView] = useState<'dashboard' | 'transactions' | 'accounts' | 'reports' | 'categories' | 'alerts' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Accounts State
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Categories & Subcategories State
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [subcategories, setSubcategories] = useState<Subcategory[]>(initialSubcategories);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCatType, setNewCatType] = useState<'expense'|'income'>('expense');
  
  const [isSubcategoryFormOpen, setIsSubcategoryFormOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [subcatParentId, setSubcatParentId] = useState<string>('');

  // Transactions list mock state
  const [transactions, setTransactions] = useState<TransactionRecord[]>(initialTransactions);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(
    initialTransactions.find(t => t.isCritical)?.id || null
  );
  const [showCriticalToast, setShowCriticalToast] = useState(false);

  useEffect(() => {
    if (activeAlertId) {
      setShowCriticalToast(true);
      setTimeout(() => setShowCriticalToast(false), 5000);
    }
  }, [activeAlertId]);

  const handleResolveAlert = (id: string, action: 'done' | 'snooze') => {
    if (action === 'done') {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, isCritical: false, hasReminder: false } : t));
    }
    if (action === 'snooze') {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, isCritical: false } : t));
      setToastMessage('Lembrete adiado por 1 hora');
      setTimeout(() => setToastMessage(''), 3000);
    }
    setActiveAlertId(null);
  };
  
  // Transaction Modal State
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [amount, setAmount] = useState('0');
  const [activeInput, setActiveInput] = useState<'amount' | 'description'>('amount');
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<'Mensal' | 'Quinzenal' | 'Semanal'>('Mensal');
  
  const [isReminderActive, setIsReminderActive] = useState(false);
  const [reminderTime, setReminderTime] = useState<'24_hours' | '12_hours' | '1_hour' | 'at_time'>('24_hours');

  const [transactionDate, setTransactionDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [description, setDescription] = useState('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  // Transaction Selectors
  const [selectedAccountId, setSelectedAccountId] = useState<string>(initialAccounts[0].id);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');

  // Reports Filter State
  const [reportsAccount, setReportsAccount] = useState<string>('all');
  const [reportsMonth, setReportsMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportsYear, setReportsYear] = useState<number>(new Date().getFullYear());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [transactionsMonth, setTransactionsMonth] = useState<number>(new Date().getMonth() + 1);
  const [transactionsYear, setTransactionsYear] = useState<number>(new Date().getFullYear());

  // Notifications
  const [toastMessage, setToastMessage] = useState('');

  // Computed
  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0);

  // --- Modal Handlers ---
  const handleOpenActionModal = () => setIsActionModalOpen(true);
  const handleCloseActionModal = () => setIsActionModalOpen(false);

  const handleOpenForm = (type: 'expense' | 'income' | 'transfer') => {
    setIsActionModalOpen(false);
    setTransactionType(type);
    
    // Auto-select first matching category
    if (type !== 'transfer') {
      const matchCat = categories.find(c => c.type === type);
      if (matchCat) {
        setSelectedCategoryId(matchCat.id);
        const subs = subcategories.filter(s => s.categoryId === matchCat.id);
        setSelectedSubcategoryId(subs.length > 0 ? subs[0].id : '');
      }
    }
    
    setIsFormOpen(true);
    setActiveInput('amount');
  };

  const handleOpenEditForm = (t: TransactionRecord) => {
    setActiveAlertId(null);
    setEditingTransactionId(t.id);
    setTransactionType(t.type);
    setAmount(t.amount.toString().replace('.', ','));
    setDescription(t.description);
    setSelectedAccountId(t.accountId || initialAccounts[0].id);
    setSelectedCategoryId(t.categoryId || '');
    setTransactionDate(t.date.includes('-') ? t.date : new Date().toISOString().split('T')[0]);
    setIsReminderActive(t.hasReminder);
    if (t.reminderTime) setReminderTime(t.reminderTime as any);
    const subs = subcategories.filter(s => s.categoryId === t.categoryId);
    setSelectedSubcategoryId(subs.length > 0 ? subs[0].id : '');
    setIsFormOpen(true);
    setActiveInput('amount');
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTransactionId(null);
    setAmount('0');
    setDescription('');
    setIsRecurring(false);
    setRecurringType('Mensal');
    setIsReminderActive(false);
    setReminderTime('24_hours');
    setIsOcrProcessing(false);
    const d = new Date();
    setTransactionDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const handleSaveTransaction = () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (numAmount === 0 && !editingTransactionId) return;
    
    let diff = 0;
    
    if (editingTransactionId) {
      const oldTx = transactions.find(t => t.id === editingTransactionId);
      const oldAmount = oldTx ? oldTx.amount : 0;
      diff = transactionType === 'income' ? numAmount - oldAmount : oldAmount - numAmount;
      
      const newTx: TransactionRecord = {
        id: editingTransactionId,
        type: transactionType,
        amount: numAmount,
        date: transactionDate,
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        description,
        hasReminder: isReminderActive,
        reminderTime: isReminderActive ? reminderTime : undefined,
        isCritical: oldTx?.isCritical
      };
      setTransactions(prev => prev.map(t => t.id === editingTransactionId ? newTx : t));
      setToastMessage('Transação atualizada com sucesso');
    } else {
      diff = transactionType === 'income' ? numAmount : -numAmount;
      const newTx: TransactionRecord = {
        id: Date.now().toString(),
        type: transactionType,
        amount: numAmount,
        date: transactionDate,
        accountId: selectedAccountId,
        categoryId: selectedCategoryId,
        description,
        hasReminder: isReminderActive,
        reminderTime: isReminderActive ? reminderTime : undefined,
      };
      setTransactions(prev => [newTx, ...prev]);
      setToastMessage('Transação salva com sucesso');
    }
    
    if (diff !== 0) {
      setAccounts(prev => prev.map(a => a.id === selectedAccountId ? { ...a, balance: a.balance + diff } : a));
    }

    setTimeout(() => setToastMessage(''), 3000);
    handleCloseForm();
  };

  const handleDeleteTransaction = () => {
    if (editingTransactionId && window.confirm('Tem a certeza que deseja excluir esta transação?')) {
      const oldTx = transactions.find(t => t.id === editingTransactionId);
      if (oldTx) {
        const diff = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
        setAccounts(prev => prev.map(a => a.id === selectedAccountId ? { ...a, balance: a.balance + diff } : a));
      }
      setTransactions(prev => prev.filter(t => t.id !== editingTransactionId));
      setToastMessage('Transação excluída com sucesso');
      setTimeout(() => setToastMessage(''), 3000);
      handleCloseForm();
    }
  };

  const generatePDFReport = () => {
    setIsGeneratingPDF(true);
    setToastMessage('A gerar PDF...');
    
    setTimeout(() => {
      try {
        const doc = new jsPDF();
        
        const accountName = reportsAccount === 'all' ? 'Todas as Contas' : (accounts.find(a => a.id === reportsAccount)?.name || '');
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const periodStr = `${months[reportsMonth - 1]} ${reportsYear}`;

        // Header
        doc.setFontSize(22);
        doc.setTextColor(20, 20, 20);
        doc.text('Relatório Financeiro', 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text(`Conta: ${accountName}`, 14, 30);
        doc.text(`Período: ${periodStr}`, 14, 36);

        // Filter transactions logically
        const filteredForPDF = transactions.filter(t => {
          const matchAcc = reportsAccount === 'all' ? true : t.accountId === reportsAccount;
          let matchTime = false;
          if (t.date.includes('-')) {
            const [y, m] = t.date.split('-');
            matchTime = Number(y) === reportsYear && Number(m) === reportsMonth;
          } else {
            matchTime = reportsMonth === (new Date().getMonth() + 1) && reportsYear === new Date().getFullYear();
          }
          return matchAcc && matchTime;
        });

        const totalIn = filteredForPDF.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
        const totalOut = filteredForPDF.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
        const balance = totalIn - totalOut;

        autoTable(doc, {
          startY: 45,
          head: [['Data', 'Descrição', 'Categoria', 'Valor']],
          body: filteredForPDF.map(t => [
            t.date,
            t.description,
            categories.find(c => c.id === t.categoryId)?.name || '-',
            { content: `${t.type === 'income' ? '+' : '-'} R$ ${t.amount.toFixed(2)}`, styles: { textColor: t.type === 'income' ? [16, 185, 129] : [244, 63, 94] } }
          ]),
          theme: 'striped',
          headStyles: { fillColor: [15, 23, 42] },
        });

        const finalY = (doc as any).lastAutoTable.finalY || 45;
        
        doc.setFontSize(10);
        doc.setTextColor(80, 80, 80);
        doc.text(`Total Entradas: R$ ${totalIn.toFixed(2)}`, 14, finalY + 10);
        doc.text(`Total Saídas: R$ ${totalOut.toFixed(2)}`, 14, finalY + 16);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(balance >= 0 ? 16 : 244, balance >= 0 ? 185 : 63, balance >= 0 ? 129 : 94);
        doc.text(`Balanço Final: R$ ${balance.toFixed(2)}`, 14, finalY + 26);

        doc.save(`Relatorio_Financas_${reportsMonth}_${reportsYear}.pdf`);
        setToastMessage('PDF gerado com sucesso!');
      } catch (error) {
        console.error(error);
        setToastMessage('Erro ao gerar PDF.');
      } finally {
        setIsGeneratingPDF(false);
        setTimeout(() => setToastMessage(''), 3000);
      }
    }, 1500);
  };

  const handleSetDefaultAccount = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAccounts(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
    setToastMessage('Conta padrão atualizada!');
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleOcrSimulation = () => {
    setIsOcrProcessing(true);
    setTimeout(() => {
      setAmount('145,50');
      const d = new Date();
      d.setDate(d.getDate() - 1); // Mocked extracting yesterday's date
      setTransactionDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      setDescription('Continente - Supermercado');
      setIsOcrProcessing(false);
    }, 1500);
  };

  const handleNumpadPress = (val: string) => {
    if (amount === '0' && val !== '0' && val !== ',') {
      setAmount(val);
    } else if (val === ',' && amount.includes(',')) {
      return;
    } else {
      if (amount.length < 10) setAmount(prev => prev + val);
    }
  };

  const handleDeletePress = () => setAmount(prev => prev.length > 1 ? prev.slice(0, -1) : '0');

  // --- Accounts CRUD ---
  const openNewAccountForm = () => { setEditingAccount(null); setIsAccountFormOpen(true); };
  const openEditAccountForm = (acc: Account) => { setEditingAccount(acc); setIsAccountFormOpen(true); };

  const saveAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const balance = parseFloat((formData.get('balance') as string).replace(',', '.'));
    
    if (editingAccount) {
      setAccounts(prev => prev.map(a => a.id === editingAccount.id ? { ...a, name, balance } : a));
    } else {
      setAccounts(prev => [...prev, { id: Date.now().toString(), name, balance, income: 0, expense: 0, iconColor: 'bg-blue-500' }]);
    }
    setIsAccountFormOpen(false);
  };
  const deleteAccount = () => {
    if (editingAccount) { setAccounts(prev => prev.filter(a => a.id !== editingAccount.id)); setIsAccountFormOpen(false); }
  };

  // --- Categories CRUD ---
  const openNewCategoryForm = (typeContext: 'expense' | 'income' = 'expense') => { 
    setEditingCategory(null); 
    setNewCatType(typeContext);
    setIsCategoryFormOpen(true); 
  };
  const openEditCategoryForm = (cat: Category) => { 
    setEditingCategory(cat); 
    setNewCatType(cat.type);
    setIsCategoryFormOpen(true); 
  };

  const saveCategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const iconColor = newCatType === 'expense' ? 'text-orange-500' : 'text-emerald-500';
    const iconPath = 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'; // Tag icon
    
    let newId = Date.now().toString();
    if (editingCategory) {
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, name, type: newCatType } : c));
      newId = editingCategory.id;
    } else {
      setCategories(prev => [...prev, { id: newId, name, type: newCatType, iconColor, iconPath }]);
    }
    
    setIsCategoryFormOpen(false);
    
    if (isFormOpen) {
      setSelectedCategoryId(newId);
    }
  };
  const deleteCategory = () => {
    if (editingCategory) { 
      setCategories(prev => prev.filter(c => c.id !== editingCategory.id));
      setSubcategories(prev => prev.filter(s => s.categoryId !== editingCategory.id));
      setIsCategoryFormOpen(false); 
    }
  };

  // --- Subcategories CRUD ---
  const openNewSubcategoryForm = (catId: string) => {
    setEditingSubcategory(null);
    setSubcatParentId(catId);
    setIsSubcategoryFormOpen(true);
  };
  const openEditSubcategoryForm = (sub: Subcategory) => {
    setEditingSubcategory(sub);
    setSubcatParentId(sub.categoryId);
    setIsSubcategoryFormOpen(true);
  };

  const saveSubcategory = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;

    let newId = Date.now().toString();
    if (editingSubcategory) {
      setSubcategories(prev => prev.map(s => s.id === editingSubcategory.id ? { ...s, name } : s));
      newId = editingSubcategory.id;
    } else {
      setSubcategories(prev => [...prev, { id: newId, categoryId: subcatParentId, name }]);
    }

    setIsSubcategoryFormOpen(false);

    if (isFormOpen) {
      setSelectedSubcategoryId(newId);
    }
  };
  const deleteSubcategory = () => {
    if (editingSubcategory) {
      setSubcategories(prev => prev.filter(s => s.id !== editingSubcategory.id));
      setIsSubcategoryFormOpen(false);
    }
  };

  // --- Utils ---
  const formatCurrency = (val: number) => `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  
  const formatDateDisplay = (dateStr: string) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (dateStr === todayStr) return 'Hoje';
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${d} de ${months[parseInt(m) - 1]}, ${y}`;
  };

  const isExpense = transactionType === 'expense';
  const isIncome = transactionType === 'income';
  const isTransfer = transactionType === 'transfer';
  
  const themeColorText = isExpense ? 'text-rose-500' : isIncome ? 'text-emerald-500' : 'text-blue-500';
  const themeColorBg = isExpense ? 'bg-rose-500' : isIncome ? 'bg-emerald-500' : 'bg-blue-600';
  const themeColorShadow = isExpense ? 'shadow-rose-500/20' : isIncome ? 'shadow-emerald-500/20' : 'shadow-blue-600/20';
  const themeColorBorderFocus = isExpense ? 'border-rose-500' : isIncome ? 'border-emerald-500' : 'border-blue-500';
  const themeColorActiveOption = isExpense ? 'bg-rose-500/20 text-rose-500' : isIncome ? 'bg-emerald-500/20 text-emerald-500' : 'bg-blue-500/20 text-blue-500';
  const toggleColorHex = isExpense ? '#f43f5e' : isIncome ? '#10b981' : '#2563eb';
  
  const formTitle = editingTransactionId ? 'Editar Transação' : (isExpense ? 'Nova Despesa' : isIncome ? 'Nova Receita' : 'Nova Transferência');
  const saveButtonText = editingTransactionId ? 'Guardar Alterações' : (isExpense ? 'Salvar Despesa' : isIncome ? 'Salvar Receita' : 'Confirmar Transferência');

  const recurringSummary = {
    'Mensal': 'Esta transação será repetida todos os meses.',
    'Quinzenal': 'Esta transação será repetida a cada 15 dias.',
    'Semanal': 'Esta transação será repetida todas as semanas.'
  }[recurringType];

  const filteredTransactionCategories = categories.filter(c => c.type === transactionType);
  const activeCategoryObj = categories.find(c => c.id === selectedCategoryId) || filteredTransactionCategories[0] || initialCategories[0];
  const activeCategorySubcategories = subcategories.filter(s => s.categoryId === activeCategoryObj.id);

  return (
    <div className="min-h-screen bg-black text-white font-sans flex flex-col relative pb-24 overflow-hidden">
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes pulseRed { 0% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); } 70% { border-color: rgba(239, 68, 68, 1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); } 100% { border-color: rgba(239, 68, 68, 0.4); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        .animate-pulse-red { animation: pulseRed 2s infinite; }
        .animate-slide-up { animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }
        .animate-slide-right { animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .toggle-checkbox:checked { right: 0; border-color: ${toggleColorHex}; }
        .toggle-checkbox:checked + .toggle-label { background-color: ${toggleColorHex}; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Critical Toast Notification Simulation */}
      {showCriticalToast && activeAlertId && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] animate-slide-up flex items-center bg-gray-900 border border-rose-500/80 p-4 rounded-2xl shadow-xl shadow-rose-500/20 min-w-[300px]">
          <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22a2 2 0 002-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" /></svg>
          </div>
          <div>
            <p className="text-rose-500 font-bold text-sm">Alerta de Vencimento</p>
            <p className="text-white text-xs mt-0.5">Transação atingiu a data estipulada.</p>
          </div>
        </div>
      )}

      {/* Critical Modal (Centralizado) */}
      {activeAlertId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setActiveAlertId(null)} />
          <div className="relative bg-gray-950 w-full max-w-sm rounded-[2rem] p-6 animate-slide-up border border-rose-500 shadow-[0_0_40px_rgba(239,68,68,0.2)] text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center mb-4 relative animate-pulse-red border border-rose-500">
               <svg className="w-10 h-10 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            {(() => {
              const t = transactions.find(tx => tx.id === activeAlertId);
              if (!t) return null;
              return (
                <>
                  <h2 className="text-2xl font-bold text-white mb-2">{t.description}</h2>
                  <p className="text-rose-400 font-bold text-xl mb-6">{formatCurrency(t.amount)}</p>
                  
                  <div className="space-y-3">
                    <button onClick={() => handleResolveAlert(t.id, 'done')} className="w-full py-4 rounded-2xl bg-rose-600 text-white font-bold text-lg active:scale-95 transition-all shadow-lg shadow-rose-600/30">
                      Confirmar
                    </button>
                    <button onClick={() => handleResolveAlert(t.id, 'snooze')} className="w-full py-4 rounded-2xl bg-gray-900 border border-gray-700 text-gray-300 font-semibold active:scale-95 transition-all hover:bg-gray-800">
                      Adiar (Soneca)
                    </button>
                  </div>
                  <button onClick={() => handleOpenEditForm(t)} className="mt-6 text-sm font-medium text-gray-500 hover:text-white transition-colors underline underline-offset-4 decoration-gray-700">
                    Editar Detalhes
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Normal Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] animate-slide-up flex items-center bg-gray-900 border border-yellow-500/50 p-4 rounded-2xl shadow-xl shadow-yellow-500/10 min-w-[300px]">
          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          </div>
          <div>
            <p className="text-yellow-500 font-bold text-sm">Aviso</p>
            <p className="text-white text-xs mt-0.5">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsSidebarOpen(false)} />
          <div className="relative w-3/4 max-w-sm bg-gray-950 h-full border-r border-gray-800 p-6 flex flex-col animate-slide-right shadow-2xl">
            <div className="flex items-center justify-between mb-10">
              <div className="flex flex-col mb-2">
                <div className="w-14 h-14 rounded-full border-2 border-gray-700 overflow-hidden mb-3 bg-gray-800">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="font-bold text-xl tracking-wide text-white leading-tight">Ricardo</h2>
                  <p className="text-gray-500 text-xs font-medium mt-0.5">Gestão Financeira</p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-900 rounded-full text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <nav className="flex flex-col space-y-2 flex-1">
              {[
                { id: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', label: 'Dashboard' },
                { id: 'transactions', icon: 'M4 6h16M4 12h16M4 18h7', label: 'Transações' },
                { id: 'accounts', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', label: 'Contas' },
                { id: 'categories', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z', label: 'Categorias' },
                { id: 'reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', label: 'Relatórios' },
                { id: 'alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', label: 'Próximos Alertas' },
                { id: 'settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z', label: 'Definições' }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => { setCurrentView(item.id as any); setIsSidebarOpen(false); }}
                  className={`flex items-center space-x-4 p-4 rounded-2xl transition-colors ${currentView === item.id ? 'bg-blue-600/10 text-blue-500' : 'text-gray-400 hover:bg-gray-900 hover:text-white'}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                  <span className="font-medium text-lg">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="pt-20 pb-10 px-6 bg-gradient-to-b from-gray-900 to-black rounded-b-[2.5rem] border-b border-gray-800/50 shadow-lg relative z-10 flex flex-col items-center text-center">
        <button onClick={() => setIsSidebarOpen(true)} className="absolute top-14 left-6 p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        {(() => {
          const defaultAccount = accounts.find(a => a.isDefault) || accounts[0] || { name: 'Sem Conta', balance: 0 };
          return (
            <div className="mt-2 flex flex-col items-center">
              <p className="text-gray-400 text-sm font-medium mb-2 flex items-center justify-center">
                {currentView === 'accounts' ? 'Saldo Global' : 
                 currentView === 'transactions' ? 'Histórico Geral' :
                 currentView === 'reports' ? 'Balanço do Período' : 
                 currentView === 'categories' ? 'Minhas Categorias' :
                 currentView === 'alerts' ? 'Notificações Ativas' : 
                 <>Saldo Atual <span className="mx-2 text-gray-700">&bull;</span> <span className="text-white">{defaultAccount.name}</span></>}
              </p>
              <h1 className="text-[2.75rem] leading-none font-extrabold tracking-tight text-white drop-shadow-md">
                {currentView === 'categories' ? categories.length : 
                 currentView === 'alerts' ? transactions.filter(t => t.hasReminder).length : 
                 currentView === 'transactions' ? transactions.length :
                 currentView === 'accounts' ? formatCurrency(totalBalance) :
                 currentView === 'reports' ? formatCurrency(totalBalance) :
                 formatCurrency(defaultAccount.balance)}
              </h1>
            </div>
          );
        })()}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-6 py-6 overflow-y-auto relative z-0 scrollbar-hide">
        {currentView === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold mb-4">Minhas Contas</h2>
              <div className="grid grid-cols-2 gap-3">
                {accounts.filter(acc => acc.balance > 0).map(acc => (
                  <div key={acc.id} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 flex flex-col justify-between h-28 active:scale-95 transition-transform cursor-pointer" onClick={() => setCurrentView('accounts')}>
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full ${acc.iconColor}/20 flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${acc.iconColor}`} />
                      </div>
                      <span className="font-medium text-sm text-white truncate">{acc.name}</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Saldo Atual</p>
                      <p className="font-bold text-lg text-white truncate">{formatCurrency(acc.balance)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {(() => {
                const urgent = transactions.filter(t => t.hasReminder);
                const recent = transactions.filter(t => !t.hasReminder);
                const recentLimit = urgent.length === 0 ? 5 : 3;
                
                return (
                  <>
                    {urgent.length > 0 && (
                      <div className="space-y-3">
                        <h2 className="text-[13px] font-bold text-yellow-500 uppercase tracking-widest flex items-center mb-4">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Agenda Urgente
                        </h2>
                        {urgent.slice(0, 3).map(t => {
                          const cat = categories.find(c => c.id === t.categoryId) || initialCategories[0];
                          return (
                            <div key={t.id} onClick={() => setActiveAlertId(t.id)} className={`p-4 bg-gray-900 rounded-2xl border flex items-center justify-between transition-all cursor-pointer active:scale-95 ${t.isCritical ? 'animate-pulse-red border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.05)] hover:border-yellow-500/40'}`}>
                              <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center relative">
                                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                </div>
                                <div>
                                  <p className="text-white font-medium">{t.description}</p>
                                  <p className={t.isCritical ? 'text-rose-400 font-bold text-xs' : 'text-yellow-500/80 text-xs'}>{t.date}</p>
                                </div>
                              </div>
                              <p className={`font-semibold ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {cat.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-3 pt-2">
                      <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-widest mb-4">Últimas Transações</h2>
                      {recent.slice(0, recentLimit).map(t => {
                        const cat = categories.find(c => c.id === t.categoryId) || initialCategories[0];
                        return (
                          <div key={t.id} onClick={() => handleOpenEditForm(t)} className="p-4 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-between cursor-pointer active:scale-95 transition-transform">
                            <div className="flex items-center space-x-4">
                              <div className={`w-10 h-10 rounded-full ${cat.type === 'income' ? 'bg-emerald-500/10' : 'bg-rose-500/10'} flex items-center justify-center`}>
                                <svg className={`w-5 h-5 ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.iconPath} /></svg>
                              </div>
                              <div>
                                <p className="text-white font-medium">{t.description}</p>
                                <p className="text-gray-500 text-xs">{t.date}</p>
                              </div>
                            </div>
                            <p className={`font-semibold ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {cat.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {currentView === 'transactions' && (
          <div className="space-y-6 animate-fade-in pb-8">
            <div className="flex items-center space-x-3 mb-6">
              <select value={transactionsMonth} onChange={e => setTransactionsMonth(Number(e.target.value))} className="bg-gray-900 border border-gray-800 text-white text-sm font-medium rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors flex-1 appearance-none">
                <option value={1}>Janeiro</option>
                <option value={2}>Fevereiro</option>
                <option value={3}>Março</option>
                <option value={4}>Abril</option>
                <option value={5}>Maio</option>
                <option value={6}>Junho</option>
                <option value={7}>Julho</option>
                <option value={8}>Agosto</option>
                <option value={9}>Setembro</option>
                <option value={10}>Outubro</option>
                <option value={11}>Novembro</option>
                <option value={12}>Dezembro</option>
              </select>
              <select value={transactionsYear} onChange={e => setTransactionsYear(Number(e.target.value))} className="bg-gray-900 border border-gray-800 text-white text-sm font-medium rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-colors w-28 appearance-none text-center">
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
            </div>

            {(() => {
              const filtered = transactions.filter(t => {
                if (t.date.includes('-')) {
                  const [y, m] = t.date.split('-');
                  return Number(y) === transactionsYear && Number(m) === transactionsMonth;
                }
                // Para os mocks estáticos de data (Hoje, Amanhã, etc), mostrar se o filtro for o mês atual.
                return transactionsMonth === (new Date().getMonth() + 1) && transactionsYear === new Date().getFullYear();
              });

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-10 bg-gray-900/50 rounded-2xl border border-dashed border-gray-800">
                    <p className="text-gray-500 font-medium">Nenhuma transação encontrada</p>
                  </div>
                );
              }

              const groups = filtered.reduce((acc, t) => {
                const rawDate = t.date.includes(',') ? t.date.split(',')[0] : t.date;
                const displayDate = rawDate.includes('-') ? formatDateDisplay(rawDate) : rawDate;
                if (!acc[displayDate]) acc[displayDate] = [];
                acc[displayDate].push(t);
                return acc;
              }, {} as Record<string, TransactionRecord[]>);

              return Object.entries(groups).map(([dateLabel, txs]) => (
                <div key={dateLabel} className="space-y-3">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest pl-2">{dateLabel}</h3>
                  <div className="space-y-3">
                    {txs.map(t => {
                      const cat = categories.find(c => c.id === t.categoryId) || initialCategories[0];
                      return (
                        <div key={t.id} onClick={() => handleOpenEditForm(t)} className="p-4 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-between cursor-pointer active:scale-95 transition-transform shadow-sm">
                          <div className="flex items-center space-x-4">
                            <div className={`w-10 h-10 rounded-full ${cat.type === 'income' ? 'bg-emerald-500/10' : 'bg-rose-500/10'} flex items-center justify-center`}>
                              <svg className={`w-5 h-5 ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.iconPath} /></svg>
                            </div>
                            <div>
                              <p className="text-white font-medium">{t.description}</p>
                              <p className="text-gray-500 text-xs">{t.date}</p>
                            </div>
                          </div>
                          <p className={`font-semibold ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {cat.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {currentView === 'alerts' && (
          <div className="space-y-6 animate-fade-in pb-8">
            <h2 className="text-xl font-semibold mb-4 text-yellow-500 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              Próximos Alertas
            </h2>
            <div className="space-y-4">
              {transactions.filter(t => t.hasReminder).map(t => {
                   const cat = categories.find(c => c.id === t.categoryId) || initialCategories[0];
                   return (
                     <div key={t.id} className="p-4 bg-gray-900 rounded-2xl border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.05)] flex items-center justify-between">
                       <div className="flex items-center space-x-4">
                         <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center">
                           <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         </div>
                         <div>
                           <p className="text-white font-medium">{t.description}</p>
                           <p className="text-yellow-500/80 text-xs">Vence: {t.date}</p>
                         </div>
                       </div>
                       <p className={`font-bold ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {formatCurrency(t.amount)}
                       </p>
                     </div>
                   );
              })}
              {transactions.filter(t => t.hasReminder).length === 0 && (
                <p className="text-gray-500 text-center py-10">Não tem nenhum alerta configurado para os próximos dias.</p>
              )}
            </div>
          </div>
        )}

        {currentView === 'accounts' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-semibold mb-4">Gestão de Contas</h2>
            {accounts.map(acc => (
              <div key={acc.id} onClick={() => openEditAccountForm(acc)} className="bg-gray-900 p-5 rounded-[1.5rem] border border-gray-800 active:scale-[0.98] transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full ${acc.iconColor}/20 flex items-center justify-center`}>
                      <div className={`w-4 h-4 rounded-full ${acc.iconColor}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-lg text-white leading-tight">{acc.name}</span>
                      {acc.isDefault && <span className="text-[10px] text-yellow-500 uppercase tracking-widest font-bold mt-0.5">Padrão</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-xl">{formatCurrency(acc.balance)}</span>
                    <button onClick={(e) => handleSetDefaultAccount(acc.id, e)} className={`mt-2 p-2 rounded-full transition-colors ${acc.isDefault ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
                      <svg className="w-4 h-4" fill={acc.isDefault ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <div className="flex items-center space-x-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    <span className="text-xs font-medium text-emerald-500">{formatCurrency(acc.income)}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-rose-500/10 px-3 py-1.5 rounded-lg">
                    <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                    <span className="text-xs font-medium text-rose-500">{formatCurrency(acc.expense)}</span>
                  </div>
                </div>
              </div>
            ))}
            
            <button onClick={openNewAccountForm} className="w-full mt-4 py-4 border-2 border-dashed border-gray-800 rounded-[1.5rem] flex items-center justify-center space-x-2 text-gray-500 hover:text-white hover:border-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span className="font-medium">Criar Nova Conta</span>
            </button>
          </div>
        )}

        {currentView === 'categories' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-xl font-semibold mb-4">Gestão de Categorias</h2>
            <div className="grid grid-cols-2 gap-3">
              {categories.map(cat => (
                <div key={cat.id} onClick={() => openEditCategoryForm(cat)} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 active:scale-95 transition-all cursor-pointer flex flex-col justify-between h-24">
                  <div className="flex items-center justify-between">
                    <div className={`w-8 h-8 rounded-full ${cat.iconColor.replace('text-', 'bg-')}/10 flex items-center justify-center`}>
                      <svg className={`w-4 h-4 ${cat.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.iconPath} /></svg>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-md uppercase font-bold tracking-widest ${cat.type === 'income' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                      {cat.type === 'income' ? 'REC' : 'DES'}
                    </span>
                  </div>
                  <span className="font-medium text-white truncate">{cat.name}</span>
                </div>
              ))}
            </div>
            
            <button onClick={() => openNewCategoryForm('expense')} className="w-full mt-4 py-4 border-2 border-dashed border-gray-800 rounded-[1.5rem] flex items-center justify-center space-x-2 text-gray-500 hover:text-white hover:border-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span className="font-medium">Criar Nova Categoria</span>
            </button>
          </div>
        )}

        {currentView === 'reports' && (
          <div className="space-y-6 animate-fade-in pb-8">
            <h2 className="text-xl font-semibold mb-4">Relatórios</h2>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2 bg-gray-900 p-3 rounded-xl border border-gray-800">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Conta Analisada</span>
                <select 
                  className="bg-transparent text-sm font-medium text-white outline-none w-full appearance-none cursor-pointer"
                  value={reportsAccount}
                  onChange={(e) => setReportsAccount(e.target.value)}
                >
                  <option value="all">Todas as Contas</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>

              <div className="bg-gray-900 p-3 rounded-xl border border-gray-800">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Mês</span>
                <select 
                  className="bg-transparent text-sm font-medium text-white outline-none w-full appearance-none cursor-pointer"
                  value={reportsMonth}
                  onChange={(e) => setReportsMonth(Number(e.target.value))}
                >
                  <option value={1}>Janeiro</option>
                  <option value={2}>Fevereiro</option>
                  <option value={3}>Março</option>
                  <option value={4}>Abril</option>
                  <option value={5}>Maio</option>
                  <option value={6}>Junho</option>
                  <option value={7}>Julho</option>
                  <option value={8}>Agosto</option>
                  <option value={9}>Setembro</option>
                  <option value={10}>Outubro</option>
                  <option value={11}>Novembro</option>
                  <option value={12}>Dezembro</option>
                </select>
              </div>

              <div className="bg-gray-900 p-3 rounded-xl border border-gray-800">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Ano</span>
                <select 
                  className="bg-transparent text-sm font-medium text-white outline-none w-full appearance-none cursor-pointer text-center"
                  value={reportsYear}
                  onChange={(e) => setReportsYear(Number(e.target.value))}
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
              </div>
            </div>

            <button 
              onClick={generatePDFReport}
              disabled={isGeneratingPDF}
              className={`w-full py-4 mb-6 rounded-2xl flex items-center justify-center font-bold text-lg tracking-wide transition-all shadow-lg ${isGeneratingPDF ? 'bg-gray-800 text-gray-500' : 'bg-blue-600 text-white shadow-blue-600/30 active:scale-[0.98]'}`}
            >
              {isGeneratingPDF ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  A gerar PDF...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Exportar PDF
                </>
              )}
            </button>

            {(() => {
              const filteredTxs = transactions.filter(t => {
                const matchAcc = reportsAccount === 'all' ? true : t.accountId === reportsAccount;
                let matchTime = false;
                if (t.date.includes('-')) {
                  const [y, m] = t.date.split('-');
                  matchTime = Number(y) === reportsYear && Number(m) === reportsMonth;
                } else {
                  matchTime = reportsMonth === (new Date().getMonth() + 1) && reportsYear === new Date().getFullYear();
                }
                return matchAcc && matchTime;
              });

              const totalIn = filteredTxs.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
              const totalOut = filteredTxs.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
              const balance = totalIn - totalOut;

              return (
                <div className="bg-gray-900 p-5 rounded-[1.5rem] border border-gray-800 flex justify-between items-center mb-6">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Entradas</p>
                    <p className="text-emerald-500 font-semibold">{formatCurrency(totalIn)}</p>
                  </div>
                  <div className="w-px h-8 bg-gray-800"></div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Saídas</p>
                    <p className="text-rose-500 font-semibold">{formatCurrency(totalOut)}</p>
                  </div>
                  <div className="w-px h-8 bg-gray-800"></div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Balanço</p>
                    <p className="text-blue-500 font-bold">{formatCurrency(balance)}</p>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Transações</h3>
              {transactions.map(t => {
                const cat = categories.find(c => c.id === t.categoryId) || initialCategories[0];
                return (
                  <div key={t.id} onClick={() => handleOpenEditForm(t)} className="p-4 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-between active:scale-95 transition-transform cursor-pointer">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full ${cat.type === 'income' ? 'bg-emerald-500/10' : 'bg-rose-500/10'} flex items-center justify-center relative`}>
                        <svg className={`w-5 h-5 ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.iconPath} /></svg>
                        {t.hasReminder && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium">{t.description}</p>
                        <p className="text-gray-500 text-xs">{t.date}</p>
                      </div>
                    </div>
                    <p className={`font-semibold ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {cat.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-gray-950 border-t border-gray-800 px-8 py-4 flex justify-between items-center rounded-t-[2rem] z-30">
        <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center justify-center w-16 transition-colors ${currentView === 'dashboard' ? 'text-blue-500' : 'text-gray-500'}`}>
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span className="text-[10px] font-medium">Home</span>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 -top-6">
          <button onClick={handleOpenActionModal} className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 hover:bg-blue-500 transition-transform active:scale-90 border-[6px] border-black">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>

        <button onClick={() => setCurrentView('accounts')} className={`flex flex-col items-center justify-center w-16 transition-colors ${currentView === 'accounts' ? 'text-blue-500' : 'text-gray-500'}`}>
          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          <span className="text-[10px] font-medium">Contas</span>
        </button>
      </nav>

      {/* Account CRUD Drawer */}
      {isAccountFormOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsAccountFormOpen(false)} />
          <div className="relative bg-gray-950 rounded-t-[2.5rem] p-6 animate-slide-up border-t border-gray-800">
            <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-semibold mb-6">{editingAccount ? 'Editar Conta' : 'Nova Conta'}</h2>
            
            <form onSubmit={saveAccount} className="space-y-4">
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Nome da Conta</label>
                <input name="name" type="text" defaultValue={editingAccount?.name || ''} placeholder="Ex: Cofre, Reserva..." className="w-full bg-transparent text-white font-medium outline-none text-lg" required />
              </div>
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Saldo Inicial (R$)</label>
                <input name="balance" type="number" step="0.01" defaultValue={editingAccount?.balance || ''} placeholder="0,00" className="w-full bg-transparent text-white font-medium outline-none text-lg" required />
              </div>
              <div className="flex space-x-3 pt-4 pb-6">
                {editingAccount && <button type="button" onClick={deleteAccount} className="px-6 py-4 rounded-2xl bg-rose-500/10 text-rose-500 font-semibold active:scale-[0.98] transition-all">Excluir</button>}
                <button type="submit" className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all">Salvar Conta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category CRUD Drawer */}
      {isCategoryFormOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsCategoryFormOpen(false)} />
          <div className="relative bg-gray-950 rounded-t-[2.5rem] p-6 animate-slide-up border-t border-gray-800 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-semibold mb-6">{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</h2>
            
            <form onSubmit={saveCategory} className="space-y-4">
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Nome da Categoria</label>
                <input name="name" type="text" defaultValue={editingCategory?.name || ''} placeholder="Ex: Aluguer, Combustível..." className="w-full bg-transparent text-white font-medium outline-none text-lg" required />
              </div>

              {!editingCategory && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <button type="button" onClick={() => setNewCatType('expense')} className={`py-3 rounded-xl border ${newCatType === 'expense' ? 'border-rose-500 bg-rose-500/10 text-rose-500' : 'border-gray-800 text-gray-500'} font-medium transition-colors`}>Despesa</button>
                  <button type="button" onClick={() => setNewCatType('income')} className={`py-3 rounded-xl border ${newCatType === 'income' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : 'border-gray-800 text-gray-500'} font-medium transition-colors`}>Receita</button>
                </div>
              )}

              {/* Subcategories Management within Category Edit */}
              {editingCategory && (
                <div className="pt-4 border-t border-gray-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Subcategorias</h3>
                    <button type="button" onClick={() => openNewSubcategoryForm(editingCategory.id)} className="text-blue-500 text-sm font-medium hover:text-blue-400">+ Adicionar</button>
                  </div>
                  <div className="space-y-2">
                    {subcategories.filter(s => s.categoryId === editingCategory.id).length === 0 ? (
                      <p className="text-xs text-gray-500 italic">Sem subcategorias.</p>
                    ) : (
                      subcategories.filter(s => s.categoryId === editingCategory.id).map(sub => (
                        <div key={sub.id} className="flex justify-between items-center bg-gray-900 p-3 rounded-xl border border-gray-800">
                          <span className="text-white text-sm font-medium">{sub.name}</span>
                          <button type="button" onClick={() => openEditSubcategoryForm(sub)} className="text-gray-500 hover:text-white">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4 pb-6">
                {editingCategory && <button type="button" onClick={deleteCategory} className="px-6 py-4 rounded-2xl bg-rose-500/10 text-rose-500 font-semibold active:scale-[0.98] transition-all">Excluir</button>}
                <button type="submit" className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all">Salvar Categoria</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subcategory CRUD Drawer */}
      {isSubcategoryFormOpen && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsSubcategoryFormOpen(false)} />
          <div className="relative bg-gray-950 rounded-t-[2.5rem] p-6 animate-slide-up border-t border-gray-800">
            <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-semibold mb-6">{editingSubcategory ? 'Editar Subcategoria' : 'Nova Subcategoria'}</h2>
            
            <form onSubmit={saveSubcategory} className="space-y-4">
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Nome da Subcategoria</label>
                <input name="name" type="text" defaultValue={editingSubcategory?.name || ''} placeholder="Ex: Luz, Água, Internet..." className="w-full bg-transparent text-white font-medium outline-none text-lg" required />
              </div>

              <div className="flex space-x-3 pt-4 pb-6">
                {editingSubcategory && <button type="button" onClick={deleteSubcategory} className="px-6 py-4 rounded-2xl bg-rose-500/10 text-rose-500 font-semibold active:scale-[0.98] transition-all">Excluir</button>}
                <button type="submit" className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all">Salvar Subcategoria</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Modal (Drawer) */}
      {isActionModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleCloseActionModal} />
          <div className="relative bg-gray-900 rounded-t-[2.5rem] p-6 pt-8 animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-gray-800">
            <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mb-8 opacity-80" />
            <div className="space-y-4">
              <button onClick={() => handleOpenForm('expense')} className="w-full flex items-center p-5 bg-gray-800/80 hover:bg-gray-800 active:bg-gray-700 active:scale-[0.98] rounded-[1.5rem] transition-all border border-gray-700/50 group">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center mr-5">
                  <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
                </div>
                <span className="text-[22px] font-medium text-white tracking-wide">Nova Despesa</span>
              </button>
              
              <button onClick={() => handleOpenForm('income')} className="w-full flex items-center p-5 bg-gray-800/80 hover:bg-gray-800 active:bg-gray-700 active:scale-[0.98] rounded-[1.5rem] transition-all border border-gray-700/50 group">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mr-5">
                  <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="text-[22px] font-medium text-white tracking-wide">Nova Receita</span>
              </button>
              
              <button onClick={() => handleOpenForm('transfer')} className="w-full flex items-center p-5 bg-gray-800/80 hover:bg-gray-800 active:bg-gray-700 active:scale-[0.98] rounded-[1.5rem] transition-all border border-gray-700/50 group">
                <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mr-5">
                  <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                </div>
                <span className="text-[22px] font-medium text-white tracking-wide">Nova Transferência</span>
              </button>
            </div>
            <div className="h-6" />
          </div>
        </div>
      )}

      {/* Reusable Form Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[55] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={handleCloseForm} />
          
          <div className="relative bg-gray-950 rounded-t-[2rem] pt-5 pb-5 animate-slide-up border-t border-gray-800 h-[96vh] flex flex-col">
            <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-3" />
            
            <div className="flex justify-between items-center px-5 mb-1">
              <h2 className={`${themeColorText} font-medium tracking-wider uppercase text-xs`}>{formTitle}</h2>
              <button onClick={handleCloseForm} className="w-7 h-7 flex items-center justify-center bg-gray-900 rounded-full text-gray-400 active:scale-90 transition-transform">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-2 scrollbar-hide">
              <div className="flex flex-col items-center py-2 cursor-pointer" onClick={() => setActiveInput('amount')}>
                <div className={`flex items-baseline space-x-1 pb-1 border-b-2 transition-colors ${activeInput === 'amount' ? themeColorBorderFocus : 'border-transparent'}`}>
                  <span className="text-2xl text-gray-500">R$</span>
                  <span className={`text-[3.5rem] font-bold tracking-tight transition-colors leading-none ${amount === '0' ? 'text-gray-500' : 'text-white'}`}>{amount}</span>
                </div>
              </div>

              {isTransfer ? (
                <div className="flex items-center space-x-2 relative w-full">
                  <div className="flex-1 flex flex-col bg-gray-900 p-3 pl-4 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">De Onde</span>
                    <select className="bg-transparent text-sm font-medium text-white outline-none appearance-none w-full cursor-pointer">
                      {accounts.map(acc => <option key={acc.id} value={acc.id} className="bg-gray-900 text-white">{acc.name}</option>)}
                    </select>
                  </div>
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-gray-950 border border-gray-800 rounded-full flex items-center justify-center z-10 shadow-lg pointer-events-none">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </div>
                  <div className="flex-1 flex flex-col bg-gray-900 p-3 pl-6 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Para Onde</span>
                    <select className="bg-transparent text-sm font-medium text-white outline-none appearance-none w-full cursor-pointer">
                      {accounts.map(acc => <option key={acc.id} value={acc.id} className="bg-gray-900 text-white">{acc.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col justify-center bg-gray-900 p-3 rounded-xl border border-gray-800 transition-all text-left">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Categoria</span>
                      <select 
                        className="bg-transparent text-sm font-medium text-white outline-none appearance-none w-full cursor-pointer"
                        value={selectedCategoryId}
                        onChange={(e) => {
                          if (e.target.value === 'new') { openNewCategoryForm(transactionType as 'expense' | 'income'); }
                          else { 
                            setSelectedCategoryId(e.target.value); 
                            const subs = subcategories.filter(s => s.categoryId === e.target.value);
                            setSelectedSubcategoryId(subs.length > 0 ? subs[0].id : '');
                          }
                        }}
                      >
                        {filteredTransactionCategories.map(cat => <option key={cat.id} value={cat.id} className="bg-gray-900 text-white">{cat.name}</option>)}
                        <option value="new" className="bg-gray-800 text-blue-400 font-bold">+ Nova Categoria</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-center bg-gray-900 p-3 rounded-xl border border-gray-800 transition-all text-left">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Conta</span>
                      <select 
                        className="bg-transparent text-sm font-medium text-white outline-none appearance-none w-full cursor-pointer"
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                      >
                        {accounts.map(acc => <option key={acc.id} value={acc.id} className="bg-gray-900 text-white">{acc.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Subcategories Pills */}
                  {activeCategorySubcategories.length > 0 || selectedCategoryId ? (
                    <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide px-1">
                      {activeCategorySubcategories.map(sub => (
                        <button 
                          key={sub.id} 
                          onClick={() => setSelectedSubcategoryId(sub.id)}
                          className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${selectedSubcategoryId === sub.id ? themeColorBg + ' text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 active:scale-95'}`}
                        >
                          {sub.name}
                        </button>
                      ))}
                      <button onClick={() => openNewSubcategoryForm(selectedCategoryId)} className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border border-dashed border-gray-700 text-blue-400 bg-gray-900/50 hover:bg-gray-900 active:scale-95 transition-all">
                        + Nova Subcategoria
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              <div className={`bg-gray-900 p-3 rounded-xl border transition-colors ${activeInput === 'description' ? themeColorBorderFocus : 'border-gray-800'}`} onClick={() => setActiveInput('description')}>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={isTransfer ? "Ex: Reserva..." : "Descrição..."} className="w-full bg-transparent text-white placeholder-gray-500 outline-none text-base" readOnly={activeInput === 'amount'} onFocus={() => setActiveInput('description')} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className={`relative flex items-center ${isTransfer ? 'col-span-2' : ''} justify-between bg-gray-900 p-3 rounded-xl border border-gray-800 active:scale-95 transition-all overflow-hidden`}>
                  <div className="flex items-center space-x-2 pointer-events-none">
                    <svg className={`w-4 h-4 ${themeColorText}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className={`text-sm font-medium ${transactionDate.includes(new Date().getFullYear().toString()) && transactionDate.slice(-2) === String(new Date().getDate()).padStart(2, '0') ? 'text-white' : themeColorText}`}>
                      {formatDateDisplay(transactionDate)}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>
                {!isTransfer && (
                  <button onClick={handleOcrSimulation} disabled={isOcrProcessing} className="flex items-center justify-center space-x-2 bg-gray-900 p-3 rounded-xl border border-gray-800 active:scale-95 transition-all overflow-hidden relative">
                    {isOcrProcessing ? (
                      <div className="flex items-center space-x-2">
                        <svg className="animate-spin w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span className="text-xs font-medium text-blue-400">A Ler...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        <span className="text-xs font-medium text-blue-400">OCR IA</span>
                      </div>
                    )}
                  </button>
                )}
              </div>

              <div className="flex flex-col bg-gray-900 p-3 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">Recorrente?</span>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" id="toggle-recurring" checked={isRecurring} onChange={() => setIsRecurring(!isRecurring)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-600 transition-all z-10" />
                    <label htmlFor="toggle-recurring" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-700 cursor-pointer transition-colors"></label>
                  </div>
                </div>
                {isRecurring && (
                  <div className="flex flex-col pt-3 border-t border-gray-800 animate-fade-in mb-3">
                    <div className="flex items-center space-x-2 mb-2">
                      {(['Mensal', 'Quinzenal', 'Semanal'] as const).map(type => (
                        <button key={type} onClick={() => setRecurringType(type)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${recurringType === type ? themeColorActiveOption : 'bg-gray-800 text-gray-400'}`}>
                          {type}
                        </button>
                      ))}
                    </div>
                    <p className="text-center text-[11px] text-gray-500 font-medium">{recurringSummary}</p>
                  </div>
                )}

                <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-800">
                  <span className="text-sm font-medium text-white">Lembrar-me desta transação</span>
                  <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input type="checkbox" id="reminder-toggle" checked={isReminderActive} onChange={() => setIsReminderActive(!isReminderActive)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-600 transition-all z-10" />
                    <label htmlFor="reminder-toggle" className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-700 cursor-pointer transition-colors"></label>
                  </div>
                </div>
                {isReminderActive && (
                  <div className="flex flex-col mt-3 pt-3 border-t border-gray-800 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setReminderTime('24_hours')} className={`py-2 rounded-lg text-xs font-medium transition-colors ${reminderTime === '24_hours' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-gray-800 text-gray-400 border border-transparent'}`}>24h antes</button>
                      <button onClick={() => setReminderTime('12_hours')} className={`py-2 rounded-lg text-xs font-medium transition-colors ${reminderTime === '12_hours' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-gray-800 text-gray-400 border border-transparent'}`}>12h antes</button>
                      <button onClick={() => setReminderTime('1_hour')} className={`py-2 rounded-lg text-xs font-medium transition-colors ${reminderTime === '1_hour' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-gray-800 text-gray-400 border border-transparent'}`}>1h antes</button>
                      <button onClick={() => setReminderTime('at_time')} className={`py-2 rounded-lg text-xs font-medium transition-colors ${reminderTime === 'at_time' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-gray-800 text-gray-400 border border-transparent'}`}>No momento</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 mt-1 flex flex-col space-y-3">
              <div className="flex space-x-3">
                {editingTransactionId && (
                  <button onClick={handleDeleteTransaction} className="w-[3.25rem] h-[3.25rem] flex items-center justify-center rounded-xl bg-gray-900 border border-gray-800 text-rose-500 active:scale-95 transition-all flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
                <button onClick={handleSaveTransaction} disabled={amount === '0' && !editingTransactionId} className={`flex-1 h-[3.25rem] rounded-xl flex items-center justify-center font-semibold text-lg tracking-wide transition-all shadow-lg ${amount === '0' && !editingTransactionId ? 'bg-gray-800 text-gray-500 shadow-none' : `${themeColorBg} text-white ${themeColorShadow} active:scale-[0.98]`}`}>
                  {saveButtonText}
                </button>
              </div>
              {activeInput === 'amount' && (
                <div className="grid grid-cols-3 gap-2 animate-fade-in">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button key={num} onClick={(e) => { e.stopPropagation(); handleNumpadPress(num.toString()); }} className="h-12 rounded-xl bg-gray-900 active:bg-gray-800 active:scale-[0.95] transition-all flex items-center justify-center text-2xl font-medium text-white">{num}</button>
                  ))}
                  <button onClick={(e) => { e.stopPropagation(); handleNumpadPress(','); }} className="h-12 rounded-xl bg-gray-900 active:bg-gray-800 active:scale-[0.95] transition-all flex items-center justify-center text-2xl font-medium text-gray-400">,</button>
                  <button onClick={(e) => { e.stopPropagation(); handleNumpadPress('0'); }} className="h-12 rounded-xl bg-gray-900 active:bg-gray-800 active:scale-[0.95] transition-all flex items-center justify-center text-2xl font-medium text-white">0</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeletePress(); }} className={`h-12 rounded-xl bg-gray-900 active:bg-gray-800 active:scale-[0.95] transition-all flex items-center justify-center ${themeColorText}`}>
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg>
                  </button>
                </div>
              )}
            </div>
            <div className={activeInput === 'amount' ? 'h-2' : 'h-6'} /> 
          </div>
        </div>
      )}
    </div>
  );
}
