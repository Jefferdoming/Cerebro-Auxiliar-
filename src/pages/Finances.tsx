import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, collection, addDoc, query, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { TrendingDown, TrendingUp, X, Plus, Trash2, Brain, DollarSign, Calendar, Landmark, PiggyBank, ReceiptText, ArrowRight, Star, Shield, AlertCircle, Loader2, Sparkles, Bike, MapPin, Navigation } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { FinanceData, Loan, Investment, FinancialRecord, DeliverySession, UserProfile } from '../types';

const MODEL_NAME = "gemini-3-flash-preview";
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function Finances() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [deliveries, setDeliveries] = useState<DeliverySession[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isImpulseCheck, setIsImpulseCheck] = useState(false);
  const [isAddRecord, setIsAddRecord] = useState(false);
  const [isAddLoan, setIsAddLoan] = useState(false);
  const [isAddInvestment, setIsAddInvestment] = useState(false);
  const [isAddDelivery, setIsAddDelivery] = useState(false);
  const [isAIAnalysis, setIsAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'impulse' | 'deliveries'>('dashboard');
  
  // Forms...
  const [newDelivery, setNewDelivery] = useState({
    date: new Date().toISOString().split('T')[0],
    appUsed: 'iFood' as any,
    deliveriesCount: '',
    grossIncome: '',
    fuelCost: '',
    maintenanceCost: '0',
    totalKm: '',
    tips: '0'
  });
  const [impulseForm, setImpulseForm] = useState({
    description: '',
    reason: '',
    price: '',
    mood: 'neutral' as 'hungry' | 'tired' | 'stressed' | 'neutral',
    waitTime: 'less_than_24h',
    utilityScore: 3,
    pleasureVsNeed: 5 // 1: Need, 10: Pleasure/Dopamine
  });
  const [impulseAIResult, setImpulseAIResult] = useState<string | null>(null);
  const [loadingImpulseAI, setLoadingImpulseAI] = useState(false);
  const [isPartialPayment, setIsPartialPayment] = useState(false);
  const [activeRecordForPartial, setActiveRecordForPartial] = useState<FinancialRecord | null>(null);
  const [partialAmount, setPartialAmount] = useState('');

  // New Record Form State
  const [newRec, setNewRec] = useState({
    type: 'bill' as 'income' | 'bill' | 'debt',
    amount: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 3
  });

  const [newLoan, setNewLoan] = useState({
    description: '',
    totalAmount: '',
    monthlyAmount: '',
    totalInstallments: 12,
    paidInstallments: 0,
    priority: 3
  });

  const [newInv, setNewInv] = useState({
    description: '',
    amount: '',
    type: 'capitalization' as 'capitalization' | 'piggybank' | 'other',
    totalInstallments: 0,
    paidInstallments: 0,
    monthlyContribution: '',
    priority: 1
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const docRef = doc(db, 'finances', auth.currentUser.uid);
    const unsubData = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        setData(snapshot.data() as FinanceData);
      } else {
        const initial = {
          userId: auth.currentUser!.uid,
          totalDebt: 21529,
          monthlyMeta: 500,
          lastImpulseCheck: new Date(),
          createdAt: new Date()
        };
        setDoc(docRef, initial);
      }
    });

    const q = query(collection(db, 'financial_records'), where('userId', '==', auth.currentUser.uid));
    const unsubRecords = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as FinancialRecord[];
      setRecords(list);
    });

    const unsubLoans = onSnapshot(query(collection(db, 'loans'), where('userId', '==', auth.currentUser.uid)), (snapshot) => {
      setLoans(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Loan[]);
    });

    const unsubInvestments = onSnapshot(query(collection(db, 'investments'), where('userId', '==', auth.currentUser.uid)), (snapshot) => {
      setInvestments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Investment[]);
    });

    const unsubDeliveries = onSnapshot(query(collection(db, 'deliveries'), where('userId', '==', auth.currentUser.uid)), (snapshot) => {
      setDeliveries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DeliverySession[]);
    });

    const unsubProfile = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snapshot) => {
      if (snapshot.exists()) setProfile(snapshot.data() as UserProfile);
    });

    return () => { unsubData(); unsubRecords(); unsubLoans(); unsubInvestments(); unsubDeliveries(); unsubProfile(); };
  }, []);

  const addDelivery = async () => {
    if (!auth.currentUser || !newDelivery.grossIncome) return;
    const gross = parseFloat(newDelivery.grossIncome);
    const fuel = parseFloat(newDelivery.fuelCost || '0');
    const maint = parseFloat(newDelivery.maintenanceCost || '0');
    const tips = parseFloat(newDelivery.tips || '0');
    
    // Add to delivery log
    const deliveryData = {
      userId: auth.currentUser.uid,
      ...newDelivery,
      deliveriesCount: parseInt(newDelivery.deliveriesCount || '0'),
      grossIncome: gross,
      fuelCost: fuel,
      maintenanceCost: maint,
      tips: tips,
      totalKm: parseFloat(newDelivery.totalKm || '0'),
      status: 'completed',
      createdAt: serverTimestamp()
    };
    
    await addDoc(collection(db, 'deliveries'), deliveryData);

    // Automatically create a financial record for the income
    await addDoc(collection(db, 'financial_records'), {
      userId: auth.currentUser.uid,
      type: 'income',
      category: 'delivery',
      amount: gross + tips,
      description: `Entregas ${newDelivery.appUsed} - ${newDelivery.date}`,
      status: 'received',
      dueDate: newDelivery.date,
      priority: 5,
      createdAt: serverTimestamp()
    });

    // Automatically create negative records for expenses if relevant (optional, let's keep it simple for now)

    setIsAddDelivery(false);
    setNewDelivery({
      date: new Date().toISOString().split('T')[0],
      appUsed: 'iFood',
      deliveriesCount: '',
      grossIncome: '',
      fuelCost: '',
      maintenanceCost: '0',
      totalKm: '',
      tips: '0'
    });
  };

  const addLoan = async (loan: Omit<Loan, 'id' | 'userId' | 'createdAt'>) => {
    if (!auth.currentUser) return;
    await addDoc(collection(db, 'loans'), {
      userId: auth.currentUser.uid,
      ...loan,
      priority: loan.priority || 3,
      createdAt: serverTimestamp()
    });
    setIsAddLoan(false);
    setNewLoan({ description: '', totalAmount: '', monthlyAmount: '', totalInstallments: 12, paidInstallments: 0, priority: 3 });
  };

  const addInvestment = async (investment: Omit<Investment, 'id' | 'userId' | 'createdAt'>) => {
    if (!auth.currentUser) return;
    await addDoc(collection(db, 'investments'), {
      userId: auth.currentUser.uid,
      ...investment,
      priority: investment.priority || 1,
      createdAt: serverTimestamp()
    });
    setIsAddInvestment(false);
    setNewInv({ description: '', amount: '', type: 'capitalization', totalInstallments: 0, paidInstallments: 0, monthlyContribution: '', priority: 1 });
  };

  const deleteLoan = async (id: string) => {
    await deleteDoc(doc(db, 'loans', id));
  };

  const deleteInvestment = async (id: string) => {
    await deleteDoc(doc(db, 'investments', id));
  };

  const deleteDelivery = async (id: string) => {
    await deleteDoc(doc(db, 'deliveries', id));
  };

  const updateLoanInstallment = async (loan: Loan, increment: boolean) => {
    const newVal = Math.max(0, Math.min(loan.totalInstallments, loan.paidInstallments + (increment ? 1 : -1)));
    await updateDoc(doc(db, 'loans', loan.id), { paidInstallments: newVal });
  };

  const addRecord = async () => {
    if (!auth.currentUser || !newRec.amount || !newRec.description) return;
    await addDoc(collection(db, 'financial_records'), {
      userId: auth.currentUser.uid,
      ...newRec,
      amount: parseFloat(newRec.amount),
      priority: newRec.priority || 3,
      status: (newRec.type === 'income') ? 'received' : 'pending',
      createdAt: serverTimestamp()
    });
    setIsAddRecord(false);
    setNewRec({ type: 'bill', amount: '', description: '', dueDate: new Date().toISOString().split('T')[0], priority: 3 });
  };

  const deleteRecord = async (id: string) => {
    await deleteDoc(doc(db, 'financial_records', id));
  };

  const toggleStatus = async (record: FinancialRecord) => {
    const newStatus = record.type === 'income' 
      ? (record.status === 'received' ? 'pending' : 'received')
      : (record.status === 'paid' ? 'pending' : 'paid');
    
    await updateDoc(doc(db, 'financial_records', record.id), { status: newStatus });
  };

  const handlePartialPayment = async () => {
    if (!auth.currentUser || !activeRecordForPartial || !partialAmount) return;
    const payment = parseFloat(partialAmount);
    if (isNaN(payment) || payment <= 0) return;

    const newAmount = Math.max(0, activeRecordForPartial.amount - payment);
    const updates: any = { amount: newAmount };
    
    if (newAmount === 0) {
      updates.status = activeRecordForPartial.type === 'income' ? 'received' : 'paid';
    }

    await updateDoc(doc(db, 'financial_records', activeRecordForPartial.id), updates);
    setIsPartialPayment(false);
    setActiveRecordForPartial(null);
    setPartialAmount('');
  };

  const performAIAnalysis = async () => {
    setLoadingAI(true);
    setIsAIAnalysis(true);
    try {
      const prompt = `Você é o estrategista financeiro pessoal deste usuário que tem TDAH e trabalha como Professor e Motoboy.
      Analise a situação financeira total e forneça sugestões prioritárias para quitação de dívidas e otimização.

      FILOSOFIA: "Começar com o Fim em Mente" (The 7 Habits). Conecte as ações de hoje ao objetivo de liberdade financeira.

      CONTEXTO: 
      - Meta Principal: Quitar dívida estrutural de R$ 21.529,00.
      - Período de Colapso: parado de 17/04 a 29/04 (fluxo de caixa reduzido).

      DADOS REAIS DO USUÁRIO:
      1. LANÇAMENTOS DO MÊS:
      ${records.map(r => `- ${r.type.toUpperCase()}: R$ ${r.amount} (${r.description}) - Status: ${r.status}`).join('\n')}

      2. EMPRÉSTIMOS E DÍVIDAS:
      ${loans.map(l => `- ${l.description}: R$ ${l.monthlyAmount}/mês (${l.paidInstallments}/${l.totalInstallments} pagas)`).join('\n')}

      3. INVESTIMENTOS E RESERVAS:
      ${investments.map(i => `- ${i.description} (${i.type}): Saldo R$ ${i.amount}.`).join('\n')}

      ESTRUTURA DA RESPOSTA (Markdown):
      # 📋 CHECKLIST PRIORIZADO DE AÇÕES
      (Lista de tarefas imediatas baseada em impacto real e prioridade de quitação)

      ## 🧠 ANÁLISE ESTRATÉGICA (Capitalização)
      (Tenho duas capitalizações no BCB (60xR$50 e 60xR$70). Resgatar para amortizar os R$21k ou manter?)

      ## 💎 OTIMIZAÇÃO (Professor/Motoboy)
      (Como maximizar sobras baseado na rotina)

      ## 🧘 FOCO E TDAH
      (Orientação cognitiva para evitar paralisia por análise)

      Responda em Português com tom profissional e empático.`;

      const result = await genAI.models.generateContent({
        model: MODEL_NAME,
        contents: prompt
      });

      setAiAnalysis(result.text || "Sem resposta da IA.");
    } catch (error) {
      console.error(error);
      setAiAnalysis("Erro na análise. Verifique sua conexão ou API Key.");
    } finally {
      setLoadingAI(false);
    }
  };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthRecords = records.filter(r => r.dueDate?.startsWith(currentMonth));
  
  const todayDate = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(todayDate.getDate() + 3);

  const dueSoonRecords = records.filter(r => {
    if (r.status !== 'pending' || !r.dueDate) return false;
    if (r.type === 'income') return false;
    const dueDate = new Date(r.dueDate + 'T00:00:00'); // Ensure local time
    return dueDate >= todayDate && dueDate <= threeDaysFromNow;
  });

  const monthTotals = {
    income: monthRecords.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0),
    expenses: monthRecords.filter(r => r.type === 'bill' || r.type === 'debt').reduce((acc, r) => acc + r.amount, 0),
  };
  const monthBalance = monthTotals.income - monthTotals.expenses;

  const totals = {
    income: records.filter(r => r.type === 'income').reduce((acc, r) => acc + r.amount, 0),
    bills: records.filter(r => (r.type === 'bill' || r.type === 'debt') && r.status === 'pending').reduce((acc, r) => acc + r.amount, 0),
    structuralDebt: data?.totalDebt || 21529
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <header className="space-y-4">
        <h1 className="text-5xl font-light tracking-tight">Gestão <span className="font-bold whitespace-nowrap">Financeira</span></h1>
        <div className="flex items-center justify-between border-b border-black/5 pb-8 mb-4">
          <div className="flex gap-8">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "text-sm font-bold uppercase tracking-widest pb-2 transition-all",
                activeTab === 'dashboard' ? "text-brand-primary border-b-2 border-brand-primary" : "text-slate-700"
              )}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab('impulse')}
              className={cn(
                "text-sm font-bold uppercase tracking-widest pb-2 transition-all",
                activeTab === 'impulse' ? "text-brand-primary border-b-2 border-brand-primary" : "text-slate-700"
              )}
            >
              Consciência de Consumo
            </button>
            {profile?.secondaryRole === 'motoboy' && (
              <button 
                onClick={() => setActiveTab('deliveries')}
                className={cn(
                  "text-sm font-bold uppercase tracking-widest pb-2 transition-all",
                  activeTab === 'deliveries' ? "text-brand-primary border-b-2 border-brand-primary" : "text-slate-700"
                )}
              >
                Log de Entregas
              </button>
            )}
          </div>
          <button 
            onClick={performAIAnalysis}
            className="flex items-center gap-2 px-8 py-3 bg-brand-primary text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-zinc-200"
          >
            <Brain size={16} /> IA Analisar
          </button>
        </div>
      </header>

      {activeTab === 'dashboard' ? (
        <>
          {/* Alerta de Vencimento Próximo (ADHD Focus) */}
      <AnimatePresence>
        {dueSoonRecords.length > 0 && (
          <motion.section 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-brand-accent/5 border-2 border-brand-accent/20 rounded-[3rem] p-8 flex flex-col md:flex-row items-center gap-6 shadow-lg shadow-red-50">
              <div className="w-16 h-16 bg-brand-accent text-white rounded-full flex items-center justify-center shrink-0 animate-pulse">
                <AlertCircle size={32} />
              </div>
              <div className="flex-grow space-y-1">
                <h3 className="text-xl font-bold tracking-tight text-brand-accent">Atenção ao Vencimento!</h3>
                <p className="text-slate-600 font-medium leading-tight">
                  Você tem <span className="font-bold text-slate-800">{dueSoonRecords.length} lançamentos</span> vencendo nos próximos 3 dias. Evite juros desnecessários.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {dueSoonRecords.map(r => (
                  <div key={r.id} className="bg-white/80 backdrop-blur px-4 py-2 rounded-xl border border-brand-accent/10 text-[10px] font-bold uppercase tracking-widest text-brand-accent">
                    {r.description} ({r.dueDate})
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Resumo do Mês (ADHD Friendly) */}
      <section className="bg-white border border-slate-100 rounded-[3rem] p-10 space-y-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-slate-800">
            <Landmark size={24} className="text-brand-primary" />
            <h3 className="text-2xl font-light tracking-tight">Resumo do <span className="font-bold">Mês Atual</span></h3>
          </div>
          {profile?.secondaryRole === 'motoboy' && (
            <div className="flex items-center gap-2 bg-zinc-50 px-4 py-2 rounded-2xl border border-zinc-100">
              <Bike size={14} className="text-brand-primary" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Total Moto: R$ {deliveries.reduce((acc, d) => acc + d.grossIncome + d.tips, 0).toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-600">Entradas</p>
            <p className="text-4xl font-light tracking-tighter text-slate-800">
              <span className="text-lg opacity-60 mr-1">R$</span> {monthTotals.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">Saídas</p>
            <p className="text-4xl font-light tracking-tighter text-slate-800">
              <span className="text-lg opacity-60 mr-1">R$</span> {monthTotals.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-6 bg-slate-50 rounded-[2rem] space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Saldo Líquido</p>
            <p className={cn(
              "text-4xl font-bold tracking-tighter",
              monthBalance >= 0 ? "text-brand-primary" : "text-brand-accent"
            )}>
              <span className="text-lg opacity-60 mr-1">R$</span> {monthBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </section>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="adhd-card !bg-[#1A1A1A] text-white p-8 space-y-4 rounded-[2.5rem] relative overflow-hidden group">
          {profile?.secondaryRole === 'motoboy' && <Bike className="absolute -right-4 -bottom-4 text-white opacity-5 w-24 h-24 group-hover:rotate-12 transition-transform" />}
          <p className="text-[10px] uppercase tracking-widest text-slate-300 font-bold">Renda Acumulada</p>
          <div className="text-3xl font-light tracking-tighter">
            <span className="opacity-60 italic mr-1 text-xl">R$</span> {totals.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="adhd-card p-8 space-y-4 rounded-[2.5rem] border-brand-accent/20">
          <p className="text-[10px] uppercase tracking-widest text-brand-accent font-bold">Contas Pendentes</p>
          <div className="text-3xl font-light tracking-tighter text-brand-accent">
            <span className="opacity-30 italic mr-1 text-xl">R$</span> {totals.bills.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="adhd-card p-8 bg-zinc-50 border-brand-border space-y-4 rounded-[2.5rem]">
          <p className="text-[10px] uppercase tracking-widest text-slate-700 font-bold">Dívida Estrutural</p>
          <div className="text-3xl font-light tracking-tighter text-slate-800">
            <span className="opacity-60 italic mr-1 text-xl">R$</span> {totals.structuralDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-90">Lançamentos</h3>
          <div className="flex gap-4">
            {profile?.secondaryRole === 'motoboy' && (
              <button 
                onClick={() => setIsAddDelivery(true)}
                className="text-[10px] font-bold uppercase tracking-widest text-[#8b5cf6] flex items-center gap-1 hover:underline underline-offset-8"
              >
                <Bike size={14} /> Logar Entrega
              </button>
            )}
            <button 
              onClick={() => setIsAddRecord(true)}
              className="text-[10px] font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1 hover:underline underline-offset-8"
            >
              <Plus size={14} /> Novo Lançamento
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {records.length > 0 ? records.sort((a,b) => {
            if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
            return (b.priority || 0) - (a.priority || 0);
          }).map(rec => (
            <div key={rec.id} className={cn(
              "task-card p-6 flex justify-between items-center group bg-white",
              rec.status === 'paid' || rec.status === 'received' ? "opacity-70" : ""
            )}>
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => toggleStatus(rec)}
                  className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                    rec.status === 'paid' || rec.status === 'received' ? "bg-green-500 text-white" : "bg-zinc-50 border border-zinc-100 text-slate-300"
                  )}
                >
                  {rec.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                </button>
                <div>
                  <p className={cn(
                    "text-xl font-medium tracking-tight",
                    rec.status === 'paid' || rec.status === 'received' ? "text-slate-400 line-through" : "text-slate-800"
                  )}>
                    {rec.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
                      {rec.type === 'income' ? 'Carga Horária / Entrega' : 'Vencimento'} • {rec.dueDate || 'N/A'}
                    </p>
                    <div className="flex items-center gap-0.5 ml-2">
                      {[1, 2, 3, 4, 5].map(p => (
                        <Star key={p} size={8} className={cn(p <= (rec.priority || 0) ? "text-brand-primary fill-current" : "text-slate-100")} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <span className={cn(
                  "text-2xl font-light tracking-tighter",
                  rec.type === 'income' ? "text-green-600" : "text-red-500"
                )}>
                  {rec.type === 'income' ? '+' : '-'} R$ {rec.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                {rec.status === 'pending' && (rec.type === 'bill' || rec.type === 'debt') && (
                  <button 
                    onClick={() => {
                      setActiveRecordForPartial(rec);
                      setIsPartialPayment(true);
                      setPartialAmount('');
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[9px] font-bold uppercase tracking-widest text-brand-primary p-2 border border-brand-primary/20 rounded-lg hover:bg-brand-primary/5 transition-all"
                  >
                    Quitar Parcial
                  </button>
                )}
                <button onClick={() => deleteRecord(rec.id)} className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-brand-accent transition-all">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          )) : (
            <div className="task-card !p-20 text-center opacity-30 border-dashed border-2 border-slate-100 bg-zinc-50/30">
              <DollarSign className="mx-auto mb-4" size={48} />
              <p className="italic text-lg">Nenhum lançamento registrado.</p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Use o botão no topo para começar.</p>
            </div>
          )}
        </div>
      </section>

      {/* Loans Section */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-2 opacity-90">
            <Landmark size={14} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Empréstimos / Parcelados</h3>
          </div>
          <button 
            onClick={() => setIsAddLoan(true)}
            className="text-[10px] font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1 hover:underline underline-offset-8"
          >
            <Plus size={14} /> Novo Empréstimo
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loans.sort((a,b) => (b.priority || 0) - (a.priority || 0)).map(loan => (
            <div key={loan.id} className="adhd-card p-6 bg-white border-brand-border space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-lg font-bold tracking-tight text-slate-700">{loan.description}</h4>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(p => (
                          <Star key={p} size={8} className={cn(p <= (loan.priority || 0) ? "text-brand-primary fill-current" : "text-slate-100")} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Parcela: R$ {loan.monthlyAmount.toLocaleString('pt-BR')}</p>
                  </div>
                  <button onClick={() => deleteLoan(loan.id)} className="text-slate-200 hover:text-brand-accent transition-colors"><X size={16}/></button>
                </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-brand-primary">Progresso Pagamento</span>
                  <span className="text-slate-500">{loan.paidInstallments} / {loan.totalInstallments}</span>
                </div>
                <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-primary" style={{ width: `${(loan.paidInstallments / loan.totalInstallments) * 100}%` }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => updateLoanInstallment(loan, false)}
                  className="flex-1 py-2 bg-zinc-50 text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition-colors"
                >
                  Subtrair
                </button>
                <button 
                  onClick={() => updateLoanInstallment(loan, true)}
                  className="flex-1 py-2 bg-brand-primary/10 text-brand-primary rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/20 transition-colors"
                >
                  Paguei uma!
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Investments Section */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-2 opacity-60">
            <PiggyBank size={14} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Investimentos / Capitalização</h3>
          </div>
          <button 
            onClick={() => setIsAddInvestment(true)}
            className="text-[10px] font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1 hover:underline underline-offset-8"
          >
            <Plus size={14} /> Novo Investimento
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {investments.sort((a,b) => (b.priority || 0) - (a.priority || 0)).map(inv => (
            <div key={inv.id} className="adhd-card p-6 bg-[#1A1A1A] text-white border-white/5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-brand-primary">
                    <Star size={12} className="fill-current" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{inv.type === 'capitalization' ? 'Capitalização' : 'Cofrinho'}</span>
                    <div className="flex items-center gap-0.5 ml-2">
                        {[1, 2, 3, 4, 5].map(p => (
                          <Star key={p} size={8} className={cn(p <= (inv.priority || 0) ? "text-brand-primary fill-current" : "text-white/10")} />
                        ))}
                      </div>
                  </div>
                  <h4 className="text-lg font-bold tracking-tight">{inv.description}</h4>
                </div>
                <button onClick={() => deleteInvestment(inv.id)} className="text-white/20 hover:text-white transition-colors"><X size={16}/></button>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-white/70 uppercase tracking-widest mb-1">Saldo Acumulado</p>
                  <p className="text-3xl font-light tracking-tighter">
                    <span className="text-sm opacity-60 mr-1">R$</span>{inv.amount.toLocaleString('pt-BR')}
                  </p>
                </div>
                {inv.monthlyContribution && (
                  <div className="text-right">
                    <p className="text-[10px] text-white/70 uppercase tracking-widest mb-1">Contribuição</p>
                    <p className="text-sm font-bold text-brand-primary">R$ {inv.monthlyContribution}/mês</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Weekly Financial System */}
      <section className="adhd-card p-10 bg-[#F8F9FE] border-blue-100 rounded-[3rem] space-y-8">
        <div className="flex items-center gap-3 text-blue-600">
          <Calendar size={22} />
          <h3 className="text-xl font-light tracking-tight">Sistema Financeiro <span className="font-bold">Semanal</span></h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { day: "Segunda", task: "Revisar ganhos das entregas do final de semana." },
            { day: "Quarta", task: "Conferir contas que vencem nos próximos 7 dias." },
            { day: "Sexta", task: "Separar R$ 50,00 para dívida de R$ 21k (Micro-passo)." },
            { day: "Domingo", task: "Limpar a carteira de recibos e organizar o app." }
          ].map((item, i) => (
            <div key={i} className="p-6 bg-white rounded-[2rem] border border-blue-50 space-y-2 group hover:border-blue-400 transition-all">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">{item.day}</p>
              <p className="text-sm font-medium text-slate-700 tracking-tight leading-snug">{item.task}</p>
            </div>
          ))}
        </div>
      </section>

          {/* Impulse Check Trigger */}
          <div className="pt-8">
            <button 
              onClick={() => setActiveTab('impulse')}
              className="w-full py-8 bg-white border-2 border-brand-accent text-brand-accent rounded-[3rem] font-bold uppercase tracking-[0.3em] text-sm hover:bg-brand-accent hover:text-white transition-all shadow-xl shadow-red-50 flex items-center justify-center gap-3 group"
            >
              <Shield size={20} className="group-hover:animate-bounce" />
              Evitar Gasto Impulsivo
            </button>
          </div>
        </>
      ) : activeTab === 'deliveries' ? (
        <section className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-brand-border p-8 rounded-[2.5rem] space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total de Entregas</p>
                <p className="text-4xl font-light tracking-tighter text-slate-800">{deliveries.reduce((acc, d) => acc + d.deliveriesCount, 0)}</p>
              </div>
              <div className="bg-white border border-brand-border p-8 rounded-[2.5rem] space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Km Rodados</p>
                <p className="text-4xl font-light tracking-tighter text-slate-800">{deliveries.reduce((acc, d) => acc + d.totalKm, 0)} km</p>
              </div>
              <div className="bg-[#1A1A1A] p-8 rounded-[2.5rem] space-y-2 text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Líquido Estimado</p>
                <p className="text-4xl font-light tracking-tighter">
                  <span className="text-lg opacity-60 mr-1">R$</span>
                  {(deliveries.reduce((acc, d) => acc + d.grossIncome + d.tips - d.fuelCost - d.maintenanceCost, 0)).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="bg-white border border-brand-border p-8 rounded-[2.5rem] space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Gorjetas</p>
                <p className="text-4xl font-light tracking-tighter text-brand-primary">
                  <span className="text-lg opacity-60 mr-1">R$</span>
                  {deliveries.reduce((acc, d) => acc + d.tips, 0).toLocaleString('pt-BR')}
                </p>
              </div>
           </div>

           <div className="space-y-6">
              <div className="flex justify-between items-end">
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30">Histórico de Sessões</h3>
                <button 
                  onClick={() => setIsAddDelivery(true)}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1 hover:underline underline-offset-8"
                >
                  <Plus size={14} /> Logar Nova Sessão
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {deliveries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(session => (
                  <div key={session.id} className="task-card p-8 bg-white border-brand-border flex flex-col md:flex-row justify-between gap-8 group">
                    <div className="flex gap-6">
                       <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-all">
                          <Bike size={24} />
                       </div>
                       <div className="space-y-1">
                          <h4 className="text-xl font-bold tracking-tight text-slate-800">{new Date(session.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
                          <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                             <span className="flex items-center gap-1"><MapPin size={10} /> {session.totalKm} km</span>
                             <span className="flex items-center gap-1"><Navigation size={10} /> {session.deliveriesCount} entregas</span>
                             <span className="bg-zinc-100 px-2 py-0.5 rounded text-slate-500">{session.appUsed}</span>
                          </div>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-12">
                       <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Líquido</p>
                          <p className="text-2xl font-light tracking-tighter text-slate-800">
                             R$ {(session.grossIncome + session.tips - session.fuelCost - session.maintenanceCost).toLocaleString('pt-BR')}
                          </p>
                       </div>
                       <button onClick={() => deleteDelivery(session.id)} className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-brand-accent transition-all">
                          <Trash2 size={18} />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </section>
      ) : (
        <section className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-[#1A1A1A] text-white p-12 rounded-[3.5rem] shadow-2xl space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
              <Shield size={200} />
            </div>
            <header className="space-y-2 relative z-10">
              <div className="flex items-center gap-2 text-brand-primary">
                <Sparkles size={16} />
                <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Laboratório de Neuro-Consumo</span>
              </div>
              <h2 className="text-5xl font-light tracking-tight leading-none">Avaliar <span className="font-bold italic">Impulso</span></h2>
              <p className="text-slate-400 max-w-lg">
                Responda com honestidade. Sua biologia pode estar tentando te enganar em busca de uma dose rápida de dopamina.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">O que você quer comprar?</label>
                  <input 
                    placeholder="Ex: Novo Smartphone, Jogo, Pizza..." 
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-lg outline-none focus:border-brand-primary transition-all"
                    value={impulseForm.description}
                    onChange={e => setImpulseForm({...impulseForm, description: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Qual o valor aproximado?</label>
                  <input 
                    type="number"
                    placeholder="R$ 0,00" 
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-lg outline-none focus:border-brand-primary transition-all"
                    value={impulseForm.price}
                    onChange={e => setImpulseForm({...impulseForm, price: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Por que você quer isso agora?</label>
                  <textarea 
                    placeholder="Descreva o motivo ou gatilho..." 
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-lg outline-none focus:border-brand-primary transition-all resize-none"
                    value={impulseForm.reason}
                    onChange={e => setImpulseForm({...impulseForm, reason: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Como você se sente fisicamente agora?</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'hungry', label: 'Com Fome' },
                      { id: 'tired', label: 'Exausto' },
                      { id: 'stressed', label: 'Estressado' },
                      { id: 'neutral', label: 'Equilibrado' }
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => setImpulseForm({...impulseForm, mood: m.id as any})}
                        className={cn(
                          "py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                          impulseForm.mood === m.id ? "bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/20" : "border-white/10 text-slate-500 hover:border-white/30"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Você descobriu esse item hoje?</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setImpulseForm({...impulseForm, waitTime: 'today'})}
                      className={cn(
                        "flex-1 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                        impulseForm.waitTime === 'today' ? "bg-red-500 border-red-500 text-white" : "border-white/10 text-slate-500"
                      )}
                    >
                      Sim, agora
                    </button>
                    <button
                      onClick={() => setImpulseForm({...impulseForm, waitTime: 'more_than_24h'})}
                      className={cn(
                        "flex-1 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                        impulseForm.waitTime === 'more_than_24h' ? "bg-green-500 border-green-500 text-white" : "border-white/10 text-slate-500"
                      )}
                    >
                      Pesquiso há dias
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-12 relative z-10 pt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Prazer da Compra vs. Necessidade Real</label>
                  <span className="text-[10px] font-bold text-brand-primary">
                    {impulseForm.pleasureVsNeed > 7 ? 'Dopaminérgico' : impulseForm.pleasureVsNeed < 4 ? 'Utilitário' : 'Equilibrado'}
                  </span>
                </div>
                <input 
                  type="range" min="1" max="10" 
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                  value={impulseForm.pleasureVsNeed}
                  onChange={e => setImpulseForm({...impulseForm, pleasureVsNeed: parseInt(e.target.value)})}
                />
                <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-white/20">
                  <span>Sobrevivência</span>
                  <span>Desejo Puro</span>
                </div>
              </div>

              <button 
                onClick={async () => {
                  setLoadingImpulseAI(true);
                  try {
                    const prompt = `Você é um Neuropsicólogo especialista em consumo e TDAH.
                    Avalie se esta compra é um impulso dopaminérgico ou se é adequada.
                    
                    USUÁRIO: Professor e Motoboy com TDAH.
                    ITEM: ${impulseForm.description}
                    VALOR: R$ ${impulseForm.price}
                    MOTIVO DECLARADO: "${impulseForm.reason}"
                    ESTADO FÍSICO: ${impulseForm.mood === 'hungry' ? 'Fome (Dopamina baixa)' : impulseForm.mood === 'tired' ? 'Exaustão (Controle inibitório reduzido)' : impulseForm.mood === 'stressed' ? 'Estresse (Busca de alívio rápido)' : 'Equilibrado'}
                    TEMPO DE ESPERA: ${impulseForm.waitTime === 'today' ? 'Descobriu hoje (Alta novidade)' : 'Já pesquisa há mais de 24h'}
                    SCORE PRAZER (1-10): ${impulseForm.pleasureVsNeed}
                    
                    ESTRUTURA DA RESPOSTA (Markdown):
                    # 🔍 PARECER NEUROPSICOLÓGICO
                    (Veredito direto em uma frase curta)
                    
                    ## 🧠 O QUE O SEU CÉREBRO ESTÁ FAZENDO
                    (Analise o "MOTIVO DECLARADO" contra a biologia do TDAH - o motivo é racional ou uma justificativa para a dopamina?)
                    
                    ## ⚖️ CUSTO DE OPORTUNIDADE
                    (Converta o valor de R$ ${impulseForm.price} em esforço de trabalho - ex: quantos dias de entrega no sol)
                    
                    ## 🚦 VEREDITO: COMPRAR OU ESPERAR?
                    (Dê uma recomendação clara e um exercício de pausa de 5 minutos)`;
                    
                    const result = await genAI.models.generateContent({
                      model: MODEL_NAME,
                      contents: prompt
                    });
                    setImpulseAIResult(result.text || "Erro na análise.");
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setLoadingImpulseAI(false);
                  }
                }}
                disabled={loadingImpulseAI || !impulseForm.description || !impulseForm.price}
                className="w-full py-8 bg-brand-primary text-white rounded-[2.5rem] font-bold uppercase tracking-widest text-xs shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3"
              >
                {loadingImpulseAI ? <Loader2 className="animate-spin" size={16} /> : <Brain size={16} />}
                Processar Avaliação do Córtex
              </button>
            </div>
          </div>

          <AnimatePresence>
            {impulseAIResult && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-brand-border p-12 rounded-[3.5rem] shadow-xl space-y-8"
              >
                <div className="prose prose-slate max-w-none prose-h1:text-4xl prose-h1:font-light prose-h1:tracking-tight prose-h2:text-xs prose-h2:font-bold prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-brand-primary prose-p:text-lg prose-p:text-slate-600">
                  <ReactMarkdown>{impulseAIResult}</ReactMarkdown>
                </div>
                <div className="pt-8 border-t border-black/5 flex gap-4">
                  <button onClick={() => { setImpulseAIResult(null); setActiveTab('dashboard'); }} className="flex-1 py-4 bg-zinc-50 text-slate-400 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-100 transition-all">Vitória: Escolho Não Comprar</button>
                  <button onClick={() => { setImpulseAIResult(null); setIsAddRecord(true); }} className="flex-1 py-4 bg-brand-primary text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-xl transition-all">Ainda é Necessário</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      <AnimatePresence>
        {/* MODAL: PARTIAL PAYMENT */}
        {isPartialPayment && activeRecordForPartial && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsPartialPayment(false)} />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-12 relative z-10 shadow-2xl space-y-8">
              <header className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Quitação Parcial</p>
                <h2 className="text-4xl font-light tracking-tight">{activeRecordForPartial.description}</h2>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">Saldo Atual: R$ {activeRecordForPartial.amount.toLocaleString('pt-BR')}</p>
              </header>
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Quanto você pagou agora?</p>
                  <input 
                    type="number" 
                    placeholder="Valor R$" 
                    className="w-full bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none focus:border-black text-2xl font-light tracking-tighter" 
                    value={partialAmount} 
                    onChange={e => setPartialAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsPartialPayment(false)}
                  className="flex-1 py-4 bg-zinc-50 text-slate-400 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-zinc-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handlePartialPayment}
                  className="flex-[2] py-4 bg-brand-primary text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* MODAL: ADD RECORD */}
        {isAddRecord && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddRecord(false)} />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-12 relative z-10 shadow-2xl space-y-8">
              <header className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Novo Lançamento</p>
                <h2 className="text-4xl font-light tracking-tight">Organizar <span className="font-bold">Finanças</span></h2>
              </header>
              <div className="space-y-6">
                <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl">
                  {['income', 'bill', 'debt'].map(t => (
                    <button 
                      key={t} 
                      onClick={() => setNewRec({...newRec, type: t as any})} 
                      className={cn(
                        "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all", 
                        newRec.type === t ? "bg-white shadow-sm text-black" : "text-slate-400"
                      )}
                    >
                      {t === 'income' ? 'Receita' : t === 'bill' ? 'Mensal' : 'Dívida'}
                    </button>
                  ))}
                </div>
                <input 
                  placeholder="O que é esse gasto/ganho?" 
                  className="w-full bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none focus:border-black text-lg tracking-tight" 
                  value={newRec.description} 
                  onChange={e => setNewRec({...newRec, description: e.target.value})} 
                />
                <div className="flex gap-4">
                  <input 
                    type="number" 
                    placeholder="Valor R$" 
                    className="w-1/2 bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none focus:border-black text-lg font-light" 
                    value={newRec.amount} 
                    onChange={e => setNewRec({...newRec, amount: e.target.value})} 
                  />
                  <input 
                    type="date" 
                    className="w-1/2 bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none focus:border-black text-sm font-bold uppercase tracking-widest" 
                    value={newRec.dueDate} 
                    onChange={e => setNewRec({...newRec, dueDate: e.target.value})} 
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prioridade estratégica (1-5)</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(p => (
                      <button 
                        key={p}
                        onClick={() => setNewRec({...newRec, priority: p})}
                        className={cn(
                          "flex-1 py-3 rounded-xl border transition-all text-sm font-bold",
                          newRec.priority === p ? "bg-brand-primary border-brand-primary text-white shadow-lg shadow-zinc-200" : "bg-white border-zinc-100 text-slate-400 hover:border-zinc-300"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={addRecord} className="w-full py-6 bg-brand-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                Salvar Lançamento
              </button>
            </motion.div>
          </div>
        )}

        {/* MODAL: AI ANALYSIS */}
        {isAIAnalysis && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#1A1A1A]/95 backdrop-blur-2xl" onClick={() => setIsAIAnalysis(false)} />
             <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[4rem] p-12 relative z-10 shadow-2xl">
                <button onClick={() => setIsAIAnalysis(false)} className="absolute top-10 right-10 text-slate-200 hover:text-black transition-colors"><X size={32}/></button>
                <div className="space-y-10">
                  <div className="space-y-3">
                    <div className="w-16 h-16 bg-brand-primary/10 rounded-3xl flex items-center justify-center text-brand-primary">
                      <Brain size={32} />
                    </div>
                    <header>
                      <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-primary">Estrategista Financeiro IA</p>
                      <h2 className="text-5xl font-light tracking-tighter leading-none mt-2">Suas <span className="font-bold">Prioridades</span></h2>
                    </header>
                  </div>
                  
                  <div className="editorial-line" />

                  {loadingAI ? (
                    <div className="py-24 text-center space-y-6">
                      <div className="flex justify-center gap-2">
                        {[0, 1, 2].map(i => (
                          <motion.div key={i} animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} className="w-3 h-3 bg-brand-primary rounded-full" />
                        ))}
                      </div>
                      <p className="text-xl font-medium text-slate-400 italic">Processando contexto de Motoboy e TDAH...</p>
                    </div>
                  ) : (
                    <div className="prose prose-slate max-w-none prose-p:text-xl prose-p:leading-relaxed prose-li:text-lg prose-li:my-4 prose-strong:text-brand-primary prose-strong:font-bold">
                      <ReactMarkdown>{aiAnalysis || ''}</ReactMarkdown>
                    </div>
                  )}
                  
                  {!loadingAI && (
                    <button onClick={() => setIsAIAnalysis(false)} className="w-full py-8 bg-[#1A1A1A] text-white rounded-[2rem] font-bold uppercase tracking-widest text-xs mt-8 shadow-2xl active:scale-95 transition-all">
                      Focar nestas ações agora
                    </button>
                  )}
                </div>
             </motion.div>
          </div>
        )}

        {/* MODAL: ADD LOAN */}
        {isAddLoan && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddLoan(false)} />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-12 relative z-10 shadow-2xl space-y-8">
              <header className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Novo Empréstimo</p>
                <h2 className="text-4xl font-light tracking-tight text-slate-800">Dívida <span className="font-bold">Parcelada</span></h2>
              </header>
              <div className="space-y-4">
                <input 
                  placeholder="Descrição (ex: Empréstimo Nubank)" 
                  className="w-full bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none focus:border-black text-lg tracking-tight" 
                  value={newLoan.description} 
                  onChange={e => setNewLoan({...newLoan, description: e.target.value})} 
                />
                <div className="flex gap-4">
                  <input 
                    type="number" 
                    placeholder="Vl. Parcela" 
                    className="w-1/2 bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none" 
                    value={newLoan.monthlyAmount} 
                    onChange={e => setNewLoan({...newLoan, monthlyAmount: e.target.value})} 
                  />
                  <input 
                    type="number" 
                    placeholder="Total Parc." 
                    className="w-1/2 bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none" 
                    value={newLoan.totalInstallments} 
                    onChange={e => setNewLoan({...newLoan, totalInstallments: parseInt(e.target.value)})} 
                  />
                </div>
                <input 
                  type="number" 
                  placeholder="Parcelas já pagas" 
                  className="w-full bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none" 
                  value={newLoan.paidInstallments} 
                  onChange={e => setNewLoan({...newLoan, paidInstallments: parseInt(e.target.value)})} 
                />
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prioridade de Quitação (1-5)</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(p => (
                      <button 
                        key={p}
                        onClick={() => setNewLoan({...newLoan, priority: p})}
                        className={cn(
                          "flex-1 py-3 rounded-xl border transition-all text-sm font-bold",
                          newLoan.priority === p ? "bg-brand-primary border-brand-primary text-white shadow-lg shadow-zinc-200" : "bg-white border-zinc-100 text-slate-400 hover:border-zinc-300"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => addLoan({...newLoan, totalAmount: parseFloat(newLoan.monthlyAmount) * newLoan.totalInstallments, monthlyAmount: parseFloat(newLoan.monthlyAmount)})} 
                className="w-full py-6 bg-brand-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
              >
                Salvar Empréstimo
              </button>
            </motion.div>
          </div>
        )}

        {/* MODAL: ADD INVESTMENT */}
        {isAddInvestment && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddInvestment(false)} />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-12 relative z-10 shadow-2xl space-y-8">
              <header className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Novo Investimento</p>
                <h2 className="text-4xl font-light tracking-tight text-slate-800">Minha <span className="font-bold">Reserva</span></h2>
              </header>
              <div className="space-y-4">
                <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-2xl">
                  {['capitalization', 'piggybank'].map(t => (
                    <button 
                      key={t} 
                      onClick={() => setNewInv({...newInv, type: t as any})} 
                      className={cn(
                        "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all", 
                        newInv.type === t ? "bg-white shadow-sm text-black" : "text-slate-400"
                      )}
                    >
                      {t === 'capitalization' ? 'Capitalização' : 'Cofrinho'}
                    </button>
                  ))}
                </div>
                <input 
                  placeholder="Descrição (ex: Capitalização BCB)" 
                  className="w-full bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none focus:border-black text-lg tracking-tight" 
                  value={newInv.description} 
                  onChange={e => setNewInv({...newInv, description: e.target.value})} 
                />
                <input 
                  type="number" 
                  placeholder="Saldo Atual R$" 
                  className="w-full bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none" 
                  value={newInv.amount} 
                  onChange={e => setNewInv({...newInv, amount: e.target.value})} 
                />
                <input 
                  type="number" 
                  placeholder="Contribuição Mensal R$ (Opcional)" 
                  className="w-full bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none" 
                  value={newInv.monthlyContribution} 
                  onChange={e => setNewInv({...newInv, monthlyContribution: e.target.value})} 
                />
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Prioridade de Foco (1-5)</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(p => (
                      <button 
                        key={p}
                        onClick={() => setNewInv({...newInv, priority: p})}
                        className={cn(
                          "flex-1 py-3 rounded-xl border transition-all text-sm font-bold",
                          newInv.priority === p ? "bg-brand-primary border-brand-primary text-white" : "bg-white border-zinc-100 text-slate-400"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => addInvestment({...newInv, amount: parseFloat(newInv.amount), monthlyContribution: parseFloat(newInv.monthlyContribution || '0')})} 
                className="w-full py-6 bg-brand-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
              >
                Salvar Investimento
              </button>
            </motion.div>
          </div>
        )}

        {/* MODAL: ADD DELIVERY SESSION */}
        {isAddDelivery && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddDelivery(false)} />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-12 relative z-10 shadow-2xl space-y-8">
              <header className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Novo Log de Entrega</p>
                <h2 className="text-4xl font-light tracking-tight text-slate-800">Sessão <span className="font-bold">Motoboy</span></h2>
              </header>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data</label>
                      <input 
                        type="date" 
                        className="w-full bg-zinc-50 p-4 rounded-xl border border-zinc-100 outline-none" 
                        value={newDelivery.date} 
                        onChange={e => setNewDelivery({...newDelivery, date: e.target.value})} 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">App</label>
                      <select 
                        className="w-full bg-zinc-50 p-4 rounded-xl border border-zinc-100 outline-none text-sm" 
                        value={newDelivery.appUsed} 
                        onChange={e => setNewDelivery({...newDelivery, appUsed: e.target.value as any})}
                      >
                         <option value="iFood">iFood</option>
                         <option value="Rappi">Rappi</option>
                         <option value="Uber Eats">Uber Eats</option>
                         <option value="Loggi">Loggi</option>
                         <option value="Particular">Particular</option>
                         <option value="Other">Outro</option>
                      </select>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ganhos Brutos R$</label>
                      <input 
                        type="number" 
                        placeholder="R$ 0.00" 
                        className="w-full bg-zinc-50 p-4 rounded-xl border border-zinc-100 outline-none" 
                        value={newDelivery.grossIncome} 
                        onChange={e => setNewDelivery({...newDelivery, grossIncome: e.target.value})} 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gorjetas R$</label>
                      <input 
                        type="number" 
                        placeholder="R$ 0.00" 
                        className="w-full bg-zinc-50 p-4 rounded-xl border border-zinc-100 outline-none" 
                        value={newDelivery.tips} 
                        onChange={e => setNewDelivery({...newDelivery, tips: e.target.value})} 
                      />
                   </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Qtde Entregas</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        className="w-full bg-zinc-50 p-4 rounded-xl border border-zinc-100 outline-none" 
                        value={newDelivery.deliveriesCount} 
                        onChange={e => setNewDelivery({...newDelivery, deliveriesCount: e.target.value})} 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Km Total</label>
                      <input 
                        type="number" 
                        placeholder="0" 
                        className="w-full bg-zinc-50 p-4 rounded-xl border border-zinc-100 outline-none" 
                        value={newDelivery.totalKm} 
                        onChange={e => setNewDelivery({...newDelivery, totalKm: e.target.value})} 
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gasto Comb.</label>
                      <input 
                        type="number" 
                        placeholder="R$" 
                        className="w-full bg-zinc-50 p-4 rounded-xl border border-zinc-100 outline-none" 
                        value={newDelivery.fuelCost} 
                        onChange={e => setNewDelivery({...newDelivery, fuelCost: e.target.value})} 
                      />
                   </div>
                </div>
              </div>
              <button 
                onClick={addDelivery} 
                className="w-full py-6 bg-[#8b5cf6] text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
              >
                Logar Sessão e Ganhos
              </button>
            </motion.div>
          </div>
        )}

        {/* MODAL: IMPULSE CHECK */}
        {isImpulseCheck && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-[#1A1A1A]/95 backdrop-blur-3xl" 
              onClick={() => setIsImpulseCheck(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 40, opacity: 0 }} 
              animate={{ scale: 1, y: 0, opacity: 1 }} 
              exit={{ scale: 0.9, y: 40, opacity: 0 }} 
              className="bg-white w-full max-w-xl rounded-[4rem] p-16 relative z-10 shadow-2xl space-y-12"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-brand-accent">
                  <Star size={16} fill="currentColor" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em]">Barreira de Consciência</p>
                </div>
                <h2 className="text-6xl font-light tracking-tighter border-b border-black/5 pb-10 leading-none">Pausa <span className="font-bold text-brand-accent">Estratégica.</span></h2>
              </div>
              
              <div className="space-y-10">
                {[
                  "Você precisa disso agora?",
                  "Isso te afasta do seu plano financeiro?",
                  "Essa compra é baseada em uma necessidade real ou em uma emoção momentânea?"
                ].map((q, i) => (
                  <div key={i} className="flex gap-8 group">
                    <span className="text-4xl font-serif italic text-slate-100 group-hover:text-brand-accent transition-colors">0{i+1}</span>
                    <p className="text-2xl font-medium text-slate-700 tracking-tight leading-tight">{q}</p>
                  </div>
                ))}
              </div>

              <div className="pt-12 space-y-4">
                <button 
                  onClick={async () => {
                    setIsImpulseCheck(false);
                    if (auth.currentUser) {
                      await updateDoc(doc(db, 'finances', auth.currentUser.uid), {
                        lastImpulseCheck: serverTimestamp()
                      });
                    }
                  }} 
                  className="w-full py-8 bg-brand-primary text-white rounded-[2.5rem] font-bold uppercase tracking-widest text-xs shadow-2xl active:scale-95 transition-all"
                >
                  Desistir do Gasto (Vitória!)
                </button>
                <button 
                  onClick={() => {
                    setIsImpulseCheck(false);
                    setIsAddRecord(true);
                  }} 
                  className="w-full text-center text-slate-300 font-bold uppercase tracking-widest text-[10px] hover:text-slate-500 transition-colors"
                >
                  Ainda considero necessário registrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
