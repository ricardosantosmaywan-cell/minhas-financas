'use client';

import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '../lib/supabase';
import AuthScreen from '../components/AuthScreen';

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

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string;
}

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
  ocrUrl?: string;
};

// No initial mock data, entirely DB driven

export default function Home() {
  // Auth & DB
  const [session, setSession] = useState<any>(null);
  const [isLoadingDb, setIsLoadingDb] = useState(true);

  // Navigation & Views
  const [currentView, setCurrentView] = useState<'dashboard' | 'transactions' | 'accounts' | 'reports' | 'categories' | 'alerts' | 'settings'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Accounts State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isAccountFormOpen, setIsAccountFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountName, setAccountName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Categories & Subcategories State
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCatType, setNewCatType] = useState<'expense'|'income'>('expense');
  
  const [isSubcategoryFormOpen, setIsSubcategoryFormOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [subcatParentId, setSubcatParentId] = useState<string>('');

  // Transactions list mock state
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [showCriticalToast, setShowCriticalToast] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchData(session.user.id);
      else setIsLoadingDb(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchData(session.user.id);
      else setIsLoadingDb(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async (userId: string) => {
    setIsLoadingDb(true);
    try {
      const { data: accs } = await supabase.from('accounts').select('*').eq('user_id', userId);
      
      if (!accs || accs.length === 0) {
        // Create default account for new users
        await supabase.from('accounts').insert({
          user_id: userId,
          name: 'Minha Carteira',
          balance: 0
        });
        // Refetch accounts
        const { data: newAccs } = await supabase.from('accounts').select('*').eq('user_id', userId);
        if (newAccs && newAccs.length > 0) {
          setAccounts(newAccs.map(a => ({ id: a.id, name: a.name, balance: a.balance || 0, income: 0, expense: 0, iconColor: 'bg-blue-600', isDefault: a.is_default })));
          const def = newAccs.find(a => a.is_default) || newAccs[0];
          setSelectedAccountId(def.id);
        }
      } else {
        setAccounts(accs.map(a => ({ id: a.id, name: a.name, balance: a.balance || 0, income: 0, expense: 0, iconColor: 'bg-blue-600', isDefault: a.is_default })));
        const def = accs.find(a => a.is_default) || accs[0];
        setSelectedAccountId(def.id);
      }
      
      const { data: cats, error: catsError } = await supabase.from('categories').select('*').eq('user_id', userId);
      if (catsError && catsError.code !== 'PGRST116') {
        console.warn('Tabela categories pode não existir ou erro no acesso:', catsError.message);
      }
      
      if (!cats || cats.length === 0) {
        // Se a tabela existir mas estiver vazia, tentamos criar padrões. Se der 404, falhará silenciosamente.
        try {
          await supabase.from('categories').insert([
            { user_id: userId, name: 'Alimentação', type: 'expense', icon_color: 'text-orange-500', icon_path: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
            { user_id: userId, name: 'Salário', type: 'income', icon_color: 'text-blue-500', icon_path: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
            { user_id: userId, name: 'Lazer', type: 'expense', icon_color: 'text-pink-500', icon_path: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z' },
            { user_id: userId, name: 'Habitação', type: 'expense', icon_color: 'text-indigo-500', icon_path: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' }
          ]);
          const { data: newCats } = await supabase.from('categories').select('*').eq('user_id', userId);
          if (newCats) setCategories(newCats.map(c => ({ id: c.id, name: c.name, type: c.type, iconColor: c.icon_color, iconPath: c.icon_path })));
        } catch (err) {
          console.error('Erro ao inicializar categorias:', err);
        }
      } else {
        setCategories(cats.map(c => ({ id: c.id, name: c.name, type: c.type, iconColor: c.icon_color, iconPath: c.icon_path })));
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profile) {
        setUserProfile(profile);
      } else {
        // Initialize profile if not exists (handling first time login)
        const { data: newProfile } = await supabase.from('profiles').insert({ id: userId, full_name: session?.user?.email?.split('@')[0] || 'Usuário', avatar_url: '' }).select().single();
        if (newProfile) setUserProfile(newProfile);
      }
      
      const { data: txs } = await supabase.from('transactions').select('*').eq('user_id', userId);
      if (txs) {
        setTransactions(txs.map(t => ({ id: t.id, type: t.type, amount: t.amount, date: t.date, accountId: t.account_id, categoryId: categories.find(c => c.name === t.category)?.id || '', description: t.description, hasReminder: false, reminderTime: undefined, isCritical: false, ocrUrl: t.ocr_url })));
      } else {
        setTransactions([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingDb(false);
    }
  };

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
  const [ocrUrl, setOcrUrl] = useState('');
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  // Transaction Selectors
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');

  // Reports Filter State
  const [reportsAccount, setReportsAccount] = useState<string>('all');
  const [reportsStartDate, setReportsStartDate] = useState<string>(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [reportsEndDate, setReportsEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportNotes, setReportNotes] = useState<string>('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [transactionsMonth, setTransactionsMonth] = useState<number>(new Date().getMonth() + 1);
  const [transactionsYear, setTransactionsYear] = useState<number>(new Date().getFullYear());

  // Notifications & Loaders
  const [toastMessage, setToastMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
    setSelectedAccountId(t.accountId || (accounts[0] ? accounts[0].id : ''));
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

  const handleSaveTransaction = async () => {
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (numAmount === 0 && !editingTransactionId) return;
    
    setIsSaving(true);
    let diff = 0;
    
    // Resolve category name from ID
    const categoryName = categories.find(c => c.id === selectedCategoryId)?.name || '';
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      if (editingTransactionId) {
        const oldTx = transactions.find(t => t.id === editingTransactionId);
        const oldAmount = oldTx ? oldTx.amount : 0;
        diff = transactionType === 'income' ? numAmount - oldAmount : oldAmount - numAmount;
        
        const updatePayload = {
          type: transactionType,
          amount: numAmount,
          date: transactionDate,
          account_id: selectedAccountId,
          category: categoryName,
          description,
          ocr_url: ocrUrl || null,
        };
        console.log('Tentando atualizar:', updatePayload);
        const { error } = await supabase.from('transactions').update(updatePayload).eq('id', editingTransactionId);
        if (error) {
          console.log('Erro do Supabase:', error);
          alert('Erro Supabase: ' + error.message);
          throw error;
        }
        
        setToastMessage('Transação atualizada com sucesso');
      } else {
        diff = transactionType === 'income' ? numAmount : -numAmount;
        
        const insertPayload = {
          user_id: user.id,
          type: transactionType,
          amount: numAmount,
          date: transactionDate,
          account_id: selectedAccountId,
          category: categoryName,
          description,
          ocr_url: ocrUrl || null,
        };
        console.log('Tentando salvar:', insertPayload);
        const { error } = await supabase.from('transactions').insert(insertPayload);
        if (error) {
          console.log('Erro do Supabase:', error);
          alert('Erro Supabase: ' + error.message);
          throw error;
        }
        
        setToastMessage('Transação salva com sucesso');
      }
      
      if (diff !== 0 && selectedAccountId) {
        const acc = accounts.find(a => a.id === selectedAccountId);
        if (acc) {
          const newBalance = acc.balance + diff;
          const { error: accErr } = await supabase.from('accounts').update({ balance: newBalance }).eq('id', selectedAccountId);
          if (accErr) {
            console.log('Erro ao atualizar saldo:', accErr);
            alert('Erro saldo: ' + accErr.message);
            throw accErr;
          }
        }
      }
      
      await fetchData(user.id);
      setTimeout(() => setToastMessage(''), 3000);
      handleCloseForm();
    } catch (error: any) {
      console.error('Erro detalhado Supabase:', error);
      setToastMessage(error.message || 'Erro ao salvar transação');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async () => {
    if (editingTransactionId && window.confirm('Tem a certeza que deseja excluir esta transação?')) {
      try {
        const oldTx = transactions.find(t => t.id === editingTransactionId);
        if (oldTx) {
          const diff = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
          await supabase.from('transactions').delete().eq('id', editingTransactionId);
          
          const acc = accounts.find(a => a.id === oldTx.accountId);
          if (acc) {
            await supabase.from('accounts').update({ balance: acc.balance + diff }).eq('id', acc.id);
          }
          fetchData(session.user.id);
          setToastMessage('Transação excluída com sucesso');
        }
      } catch (error) {
        console.error(error);
        setToastMessage('Erro ao excluir transação');
      }
      setTimeout(() => setToastMessage(''), 3000);
      handleCloseForm();
    }
  };

  const getBase64ImageFromURL = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataURL);
      };
      img.onerror = (error) => reject(error);
      img.src = url;
    });
  };

  const generatePDFReport = async () => {
    setIsGeneratingPDF(true);
    setToastMessage('A carregar comprovativos...');
    
    try {
      const doc = new jsPDF();
      
      const accountName = reportsAccount === 'all' ? 'Todas as Contas' : (accounts.find(a => a.id === reportsAccount)?.name || '');
      const periodStr = `De ${formatDateDisplay(reportsStartDate)} até ${formatDateDisplay(reportsEndDate)}`;

      // Header
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 20);
      doc.text('Prestação de Contas', 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Conta: ${accountName}`, 14, 30);
      doc.text(`Período: ${periodStr}`, 14, 36);

      // Filter transactions
      const filteredForPDF = transactions.filter(t => {
        const matchAcc = reportsAccount === 'all' ? true : t.accountId === reportsAccount;
        const matchTime = t.date >= reportsStartDate && t.date <= reportsEndDate;
        return matchAcc && matchTime;
      });

      const totalIn = filteredForPDF.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
      const totalOut = filteredForPDF.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
      const balance = totalIn - totalOut;

      autoTable(doc, {
        startY: 45,
        head: [['Data', 'Descrição', 'Categoria', 'Anexo', 'Valor']],
        body: filteredForPDF.map(t => [
          t.date,
          t.description,
          categories.find(c => c.id === t.categoryId)?.name || '-',
          t.ocrUrl ? 'Sim' : 'Não',
          { content: `${t.type === 'income' ? '+' : '-'} € ${t.amount.toFixed(2)}`, styles: { textColor: t.type === 'income' ? [16, 185, 129] : [244, 63, 94] } }
        ]),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
      });

      let finalY = (doc as any).lastAutoTable.finalY || 45;
      
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Total Entradas: € ${totalIn.toFixed(2)}`, 14, finalY + 10);
      doc.text(`Total Saídas: € ${totalOut.toFixed(2)}`, 14, finalY + 16);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(balance >= 0 ? 16 : 244, balance >= 0 ? 185 : 63, balance >= 0 ? 129 : 94);
      doc.text(`Balanço Final: € ${balance.toFixed(2)}`, 14, finalY + 26);

      if (reportNotes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(50, 50, 50);
        doc.text('Observações:', 14, finalY + 38);
        const splitNotes = doc.splitTextToSize(reportNotes, 180);
        doc.text(splitNotes, 14, finalY + 44);
        finalY += (splitNotes.length * 5) + 44;
      }

      // Secção de Anexos
      const txsWithImages = filteredForPDF.filter(t => t.ocrUrl);
      if (txsWithImages.length > 0) {
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(20, 20, 20);
        doc.text('Anexos: Comprovantes de Despesas', 14, 20);
        
        let imgY = 30;
        for (const t of txsWithImages) {
          if (t.ocrUrl) {
            try {
              if (imgY > 240) { doc.addPage(); imgY = 20; }
              const base64 = await getBase64ImageFromURL(t.ocrUrl);
              doc.addImage(base64, 'JPEG', 14, imgY, 50, 50);
              doc.setFontSize(8);
              doc.setFont('helvetica', 'normal');
              doc.text(`${t.date} - ${t.description} (${formatCurrency(t.amount)})`, 14, imgY + 55);
              doc.setTextColor(0, 0, 255);
              doc.textWithLink('Ver Imagem Completa', 14, imgY + 60, { url: t.ocrUrl });
              doc.setTextColor(20, 20, 20);
              imgY += 75;
            } catch (err) {
              console.error('Erro ao carregar imagem para o PDF:', err);
            }
          }
        }
      }

      doc.save(`Relatorio_Prestacao_Contas_${reportsStartDate}.pdf`);
      setToastMessage('PDF gerado com sucesso!');
    } catch (error) {
      console.error(error);
      setToastMessage('Erro ao gerar PDF.');
    } finally {
      setIsGeneratingPDF(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleReportFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, transactionId: string) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    
    setToastMessage('A carregar comprovativo...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${transactionId}_${Math.random()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(filePath);
        
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ ocr_url: publicUrl })
        .eq('id', transactionId);
        
      if (updateError) throw updateError;
      
      await fetchData(session.user.id);
      setToastMessage('Comprovativo anexado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert('Erro no upload: ' + err.message);
    } finally {
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    
    setToastMessage('A atualizar foto...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
        
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, avatar_url: publicUrl });
        
      if (updateError) throw updateError;
      
      setUserProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      setToastMessage('Foto atualizada!');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao carregar avatar: ' + err.message);
    } finally {
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session || !userProfile) return;
    
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get('full_name') as string;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, full_name: fullName });
        
      if (error) throw error;
      
      setUserProfile({ ...userProfile, full_name: fullName });
      setIsProfileModalOpen(false);
      setToastMessage('Perfil atualizado!');
    } catch (err: any) {
      alert('Erro: ' + err.message);
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const handleSetDefaultAccount = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Definir todas as outras como não-padrão primeiro
      await supabase.from('accounts').update({ is_default: false }).eq('user_id', user.id);
      // Definir a selecionada como padrão
      const { error } = await supabase.from('accounts').update({ is_default: true }).eq('id', id);
      
      if (error) throw error;
      
      await fetchData(user.id);
      setToastMessage('Conta padrão atualizada!');
      setTimeout(() => setToastMessage(''), 3000);
    } catch (err: any) {
      console.error('Erro ao definir conta padrão:', err);
      alert('Erro: ' + err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;
    
    setIsOcrProcessing(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${session.user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage.from('comprovativos').upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('comprovativos').getPublicUrl(filePath);
      
      setOcrUrl(publicUrl);
      
      // Simulate OCR extraction as before
      setTimeout(() => {
        setAmount('145,50');
        const d = new Date();
        d.setDate(d.getDate() - 1);
        setTransactionDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        setDescription('Continente - Supermercado (OCR)');
        setIsOcrProcessing(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      setIsOcrProcessing(false);
      setToastMessage('Erro no upload do comprovativo');
    }
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
  const openNewAccountForm = () => { 
    setEditingAccount(null); 
    setAccountName('');
    setInitialBalance('');
    setIsAccountFormOpen(true); 
  };
  const openEditAccountForm = (acc: Account) => { 
    setEditingAccount(acc); 
    setAccountName(acc.name);
    setInitialBalance(acc.balance.toString());
    setIsAccountFormOpen(true); 
  };

  const saveAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) { 
      alert('Sessão expirada. Por favor, faça login novamente.');
      return; 
    }
    
    // Usar estados diretamente em vez de FormData
    const name = accountName;
    // Conversão explícita para número (Float)
    const balance = parseFloat(initialBalance.replace(',', '.')) || 0;
    
    setIsSaving(true);
    try {
      if (editingAccount) {
        const payload = { name, balance };
        console.log('Tentando atualizar conta:', payload);
        const { error } = await supabase.from('accounts').update(payload).eq('id', editingAccount.id);
        if (error) {
          alert('Erro Supabase: ' + JSON.stringify(error));
          throw error;
        }
        setToastMessage('Conta atualizada com sucesso');
      } else {
        const payload = {
          user_id: user.id,
          name: name,
          balance: balance
        };
        console.log('Tentando salvar conta:', payload);
        const { error } = await supabase.from('accounts').insert(payload);
        if (error) {
          alert('Erro Supabase: ' + JSON.stringify(error));
          throw error;
        }
        setToastMessage('Conta criada com sucesso');
      }
      
      await fetchData(user.id);
      setIsAccountFormOpen(false);
    } catch (error: any) {
      console.error('Erro detalhado:', error);
      setToastMessage(error.message || 'Erro ao salvar conta');
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const deleteAccount = async () => {
    if (!editingAccount || !session?.user?.id) return;
    try {
      await supabase.from('accounts').delete().eq('id', editingAccount.id);
      await fetchData(session.user.id);
      setIsAccountFormOpen(false);
      setToastMessage('Conta eliminada com sucesso');
    } catch (error) {
      console.error(error);
      setToastMessage('Erro ao eliminar conta');
    } finally {
      setTimeout(() => setToastMessage(''), 3000);
    }
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

  const saveCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const iconColor = newCatType === 'expense' ? 'text-orange-500' : 'text-emerald-500';
    const iconPath = 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'; // Tag icon
    
    setIsSaving(true);
    let newId = '';
    
    try {
      if (editingCategory) {
        const { error } = await supabase.from('categories').update({
          name,
          type: newCatType,
          icon_color: iconColor,
          icon_path: iconPath
        }).eq('id', editingCategory.id);
        if (error) throw error;
        newId = editingCategory.id;
        setToastMessage('Categoria atualizada com sucesso');
      } else {
        const { data, error } = await supabase.from('categories').insert({
          user_id: user.id,
          name,
          type: newCatType,
          icon_color: iconColor,
          icon_path: iconPath
        }).select().single();
        if (error) throw error;
        if (data) newId = data.id;
        setToastMessage('Categoria criada com sucesso');
      }
      
      await fetchData(user.id);
      setIsCategoryFormOpen(false);
      
      if (isFormOpen && newId) {
        setSelectedCategoryId(newId);
      }
    } catch (error: any) {
      console.error('Erro detalhado Supabase:', error);
      setToastMessage(error.message || 'Erro ao salvar categoria');
    } finally {
      setIsSaving(false);
      setTimeout(() => setToastMessage(''), 3000);
    }
  };

  const deleteCategory = async () => {
    if (!editingCategory || !session?.user?.id) return;
    try {
      await supabase.from('categories').delete().eq('id', editingCategory.id);
      await fetchData(session.user.id);
      setIsCategoryFormOpen(false);
      setToastMessage('Categoria eliminada com sucesso');
    } catch (error) {
      console.error(error);
      setToastMessage('Erro ao eliminar categoria');
    } finally {
      setTimeout(() => setToastMessage(''), 3000);
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
  const formatCurrency = (val: number | undefined | null) => (Number(val) || 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  
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
  const activeCategoryObj = categories.find(c => c.id === selectedCategoryId) || filteredTransactionCategories[0] || categories[0] || { id: '', name: 'Sem Categoria', type: 'expense', iconColor: 'text-gray-500', iconPath: '' };
  const activeCategorySubcategories = subcategories.filter(s => s.categoryId === activeCategoryObj.id);

  if (isLoadingDb) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white space-y-4">
        <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-gray-400 font-medium animate-pulse">A sincronizar dados...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

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
              <div className="flex flex-col mb-2 cursor-pointer" onClick={() => { setIsProfileModalOpen(true); setIsSidebarOpen(false); }}>
                <div className="w-14 h-14 rounded-full border-2 border-blue-500/30 overflow-hidden mb-3 bg-gray-800 shadow-lg shadow-blue-500/10">
                  <img src={userProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="font-bold text-xl tracking-wide text-white leading-tight">{userProfile?.full_name || 'Ricardo'}</h2>
                  <p className="text-gray-500 text-xs font-medium mt-0.5">{session?.user?.email}</p>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-900 rounded-full text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <nav className="flex flex-col space-y-2 overflow-y-auto scrollbar-hide pr-2 mb-4">
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
              
              <div className="pt-4 mt-auto border-t border-gray-900/50 space-y-2 pb-8">
                <button 
                  onClick={() => {
                    setIsRefreshing(true);
                    setToastMessage('A atualizar aplicação...');
                    setTimeout(() => window.location.reload(), 800);
                  }}
                  className="w-full flex items-center space-x-4 p-4 rounded-2xl text-blue-400 bg-blue-600/10 hover:bg-blue-600/20 transition-all border border-blue-500/30 shadow-lg shadow-blue-500/5 active:scale-[0.98]"
                >
                  <svg className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span className="font-bold text-lg">Atualizar App</span>
                </button>

                <button 
                  onClick={() => { setIsProfileModalOpen(true); setIsSidebarOpen(false); }}
                  className="w-full flex items-center space-x-4 p-4 rounded-2xl text-gray-400 hover:bg-gray-900 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <span className="font-medium text-lg">Meu Perfil</span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="pt-20 pb-10 px-6 bg-gradient-to-b from-gray-900 to-black rounded-b-[2.5rem] border-b border-gray-800/50 shadow-lg relative z-10 flex flex-col items-center text-center">
        <button onClick={() => setIsSidebarOpen(true)} className="absolute top-14 left-6 p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <button onClick={() => setIsProfileModalOpen(true)} className="absolute top-14 right-6 w-10 h-10 rounded-full border border-gray-800 overflow-hidden shadow-lg bg-gray-900">
           <img src={userProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} alt="User" className="w-full h-full object-cover" />
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
                {accounts.filter(acc => !acc.isDefault).map(acc => (
                  <div key={acc.id} className="bg-gray-900 p-4 rounded-2xl border border-gray-800 flex flex-col justify-between h-32 active:scale-95 transition-transform cursor-pointer relative group" onClick={() => setCurrentView('accounts')}>
                    <button 
                      onClick={(e) => handleSetDefaultAccount(acc.id, e)} 
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-gray-800 text-gray-500 hover:text-yellow-500 transition-colors"
                      title="Tornar Padrão"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    </button>
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-full ${acc.iconColor}/20 flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${acc.iconColor}`} />
                      </div>
                      <span className="font-medium text-sm text-white truncate pr-6">{acc.name}</span>
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
                          const cat = categories.find(c => c.id === t.categoryId) || { iconColor: 'text-gray-500', iconPath: '', name: 'Sem Categoria', type: 'expense' };
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
                        const cat = categories.find(c => c.id === t.categoryId) || { iconColor: 'text-gray-500', iconPath: '', name: 'Sem Categoria', type: 'expense' };
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
                      const cat = categories.find(c => c.id === t.categoryId) || { iconColor: 'text-gray-500', iconPath: '', name: 'Sem Categoria', type: 'expense' };
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
                   const cat = categories.find(c => c.id === t.categoryId) || { iconColor: 'text-gray-500', iconPath: '', name: 'Sem Categoria', type: 'expense' };
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
              <div className="col-span-2 bg-gray-900 p-3 rounded-xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Filtro por Conta</span>
                <select 
                  className="bg-transparent text-sm font-medium text-white outline-none w-full cursor-pointer"
                  value={reportsAccount}
                  onChange={(e) => setReportsAccount(e.target.value)}
                >
                  <option value="all">Todas as Contas</option>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>

              <div className="bg-gray-900 p-3 rounded-xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Início</span>
                <input 
                  type="date"
                  className="bg-transparent text-sm font-medium text-white outline-none w-full appearance-none cursor-pointer"
                  value={reportsStartDate}
                  onChange={(e) => setReportsStartDate(e.target.value)}
                />
              </div>

              <div className="bg-gray-900 p-3 rounded-xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Fim</span>
                <input 
                  type="date"
                  className="bg-transparent text-sm font-medium text-white outline-none w-full appearance-none cursor-pointer"
                  value={reportsEndDate}
                  onChange={(e) => setReportsEndDate(e.target.value)}
                />
              </div>

              <div className="col-span-2 bg-gray-900 p-3 rounded-xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Observações do Relatório</span>
                <textarea 
                  className="bg-transparent text-sm font-medium text-white outline-none w-full min-h-[100px] resize-none scrollbar-hide"
                  placeholder="Ex: Falta depositar X, Ajuste de caixa realizado..."
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                />
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
                const matchTime = t.date >= reportsStartDate && t.date <= reportsEndDate;
                return matchAcc && matchTime;
              });

              const totalIn = filteredTxs.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
              const totalOut = filteredTxs.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
              const balance = totalIn - totalOut;

              return (
                <>
                  <div className="bg-gray-900 p-5 rounded-[1.5rem] border border-gray-800 flex justify-between items-center mb-8">
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
                      <p className={`font-bold ${balance >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>{formatCurrency(balance)}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest pl-2">Detalhamento de Despesas</h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-hide pr-1">
                      {filteredTxs.length === 0 ? (
                        <div className="text-center py-10 bg-gray-900/30 rounded-2xl border border-dashed border-gray-800">
                          <p className="text-gray-500 text-sm">Nenhuma transação no período.</p>
                        </div>
                      ) : (
                        filteredTxs.map(t => {
                          const cat = categories.find(c => c.id === t.categoryId) || { iconColor: 'text-gray-500', iconPath: '', name: 'Sem Categoria', type: 'expense' };
                          return (
                            <div key={t.id} className="p-4 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-between active:scale-[0.99] transition-all shadow-sm">
                              <div className="flex items-center space-x-4 min-w-0 flex-1">
                                <div onClick={() => handleOpenEditForm(t)} className={`w-10 h-10 rounded-full ${cat.type === 'income' ? 'bg-emerald-500/10' : 'bg-rose-500/10'} flex items-center justify-center relative shrink-0 cursor-pointer`}>
                                  <svg className={`w-5 h-5 ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.iconPath} /></svg>
                                </div>
                                <div className="min-w-0 cursor-pointer" onClick={() => handleOpenEditForm(t)}>
                                  <p className="text-white font-medium text-sm truncate">{t.description}</p>
                                  <p className="text-gray-500 text-[10px]">{formatDateDisplay(t.date)}</p>
                                </div>
                              </div>

                              <div className="flex items-center space-x-4">
                                <div className="flex flex-col items-center">
                                  {t.ocrUrl ? (
                                    <div className="group relative">
                                      <img 
                                        src={t.ocrUrl} 
                                        alt="Recibo" 
                                        onClick={(e) => { e.stopPropagation(); setLightboxUrl(t.ocrUrl || null); }}
                                        className="w-10 h-10 rounded-lg object-cover border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer" 
                                      />
                                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center border-2 border-gray-950">
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                      </div>
                                    </div>
                                  ) : (
                                    <label className="w-10 h-10 rounded-lg bg-gray-800 border border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-700 hover:border-gray-500 transition-all">
                                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleReportFileUpload(e, t.id)} />
                                    </label>
                                  )}
                                  <span className="text-[8px] text-gray-500 uppercase mt-1 tracking-tighter">Anexo</span>
                                </div>

                                <p className={`font-semibold text-sm whitespace-nowrap ${cat.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {cat.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
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
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} type="text" placeholder="Ex: Cofre, Reserva..." className="w-full bg-transparent text-white font-medium outline-none text-lg" required />
              </div>
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Saldo Inicial (€)</label>
                <input value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} type="text" placeholder="0.00" className="w-full bg-transparent text-white font-medium outline-none text-lg" required />
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
                  <span className="text-2xl text-gray-500">€</span>
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
                  <label className="flex items-center justify-center space-x-2 bg-gray-900 p-3 rounded-xl border border-gray-800 active:scale-95 transition-all overflow-hidden relative cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleFileUpload} disabled={isOcrProcessing} className="hidden" />
                    {isOcrProcessing ? (
                      <div className="flex items-center space-x-2">
                        <svg className="animate-spin w-4 h-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span className="text-xs font-medium text-blue-400">A Ler...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        <span className="text-xs font-medium text-blue-400">{ocrUrl ? 'Imagem Carregada' : 'OCR IA'}</span>
                      </div>
                    )}
                  </label>
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
                <button onClick={handleSaveTransaction} disabled={(amount === '0' && !editingTransactionId) || isSaving} className={`flex-1 h-[3.25rem] rounded-xl flex items-center justify-center font-semibold text-lg tracking-wide transition-all shadow-lg ${(amount === '0' && !editingTransactionId) || isSaving ? 'bg-gray-800 text-gray-500 shadow-none' : `${themeColorBg} text-white ${themeColorShadow} active:scale-[0.98]`}`}>
                  {isSaving ? (
                    <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : saveButtonText}
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
      {/* Profile Settings Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setIsProfileModalOpen(false)} />
          <div className="relative bg-gray-950 w-full rounded-t-[2.5rem] p-8 animate-slide-up border-t border-gray-800">
            <div className="w-12 h-1.5 bg-gray-800 rounded-full mx-auto mb-8" />
            
            <h2 className="text-2xl font-bold text-white mb-6">Configurações do Perfil</h2>
            
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full border-4 border-blue-600/20 overflow-hidden bg-gray-900 shadow-2xl">
                  <img src={userProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer border-2 border-gray-950 hover:bg-blue-500 transition-colors shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                </label>
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-3">Tocar para alterar foto</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800 focus-within:border-blue-500 transition-colors">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Nome Completo</label>
                <input name="full_name" type="text" defaultValue={userProfile?.full_name || ''} className="w-full bg-transparent text-white font-medium outline-none text-lg" required />
              </div>
              
              <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
                <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Email (Não editável)</label>
                <p className="text-gray-400 font-medium">{session?.user?.email}</p>
              </div>

              <div className="flex space-x-3 pt-4 pb-6">
                <button type="button" onClick={() => setIsProfileModalOpen(false)} className="flex-1 py-4 rounded-2xl bg-gray-900 text-white font-semibold active:scale-95 transition-all border border-gray-800">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-[2] py-4 rounded-2xl bg-blue-600 text-white font-bold active:scale-95 transition-all shadow-lg shadow-blue-600/20">
                  {isSaving ? 'A guardar...' : 'Guardar Perfil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl animate-fade-in" onClick={() => setLightboxUrl(null)} />
          <div className="relative max-w-full max-h-full animate-zoom-in">
            <button 
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-12 right-0 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <img 
              src={lightboxUrl} 
              alt="Comprovativo" 
              className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
// End of file - Profile Photo Feature finalized.
