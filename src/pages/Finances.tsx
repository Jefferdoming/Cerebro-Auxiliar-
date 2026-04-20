import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, collection, addDoc, query, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { TrendingDown, TrendingUp, X, Plus, Trash2, Brain, DollarSign, Calendar, Landmark, PiggyBank, ReceiptText, ArrowRight, Star, Shield, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { FinanceData, Loan, Investment } from '../types';

const MODEL_NAME = "gemini-3-flash-preview";
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface FinancialRecord {
  id: string;
  type: 'income' | 'bill' | 'debt';
  amount: number;
  description: string;
  dueDate?: string;
  status: 'pending' | 'paid' | 'received';
  priority?: number;
}

export default function Finances() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [isImpulseCheck, setIsImpulseCheck] = useState(false);
  const [isAddRecord, setIsAddRecord] = useState(false);
  const [isAddLoan, setIsAddLoan] = useState(false);
  const [isAddInvestment, setIsAddInvestment] = useState(false);
  const [isAIAnalysis, setIsAIAnalysis] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // New Record Form State
  const [newRec, setNewRec] = useState({
    type: 'bill' as 'income' | 'bill' | 'debt',
    amount: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0]
  });

  const [newLoan, setNewLoan] = useState({
    description: '',
    totalAmount: '',
    monthlyAmount: '',
    totalInstallments: 12,
    paidInstallments: 0
  });

  const [newInv, setNewInv] = useState({
    description: '',
    amount: '',
    type: 'capitalization' as 'capitalization' | 'piggybank' | 'other',
    totalInstallments: 0,
    paidInstallments: 0,
    monthlyContribution: ''
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

    return () => { unsubData(); unsubRecords(); unsubLoans(); unsubInvestments(); };
  }, []);

  const addLoan = async (loan: Omit<Loan, 'id' | 'userId' | 'createdAt'>) => {
    if (!auth.currentUser) return;
    await addDoc(collection(db, 'loans'), {
      userId: auth.currentUser.uid,
      ...loan,
      createdAt: serverTimestamp()
    });
    setIsAddLoan(false);
  };

  const addInvestment = async (investment: Omit<Investment, 'id' | 'userId' | 'createdAt'>) => {
    if (!auth.currentUser) return;
    await addDoc(collection(db, 'investments'), {
      userId: auth.currentUser.uid,
      ...investment,
      createdAt: serverTimestamp()
    });
    setIsAddInvestment(false);
  };

  const deleteLoan = async (id: string) => {
    await deleteDoc(doc(db, 'loans', id));
  };

  const deleteInvestment = async (id: string) => {
    await deleteDoc(doc(db, 'investments', id));
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
      status: (newRec.type === 'income') ? 'received' : 'pending',
      createdAt: serverTimestamp()
    });
    setIsAddRecord(false);
    setNewRec({ type: 'bill', amount: '', description: '', dueDate: new Date().toISOString().split('T')[0] });
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
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest leading-relaxed">
            Fluxo de Caixa & <br />Análise de Prioridade.
          </p>
          <button 
            onClick={performAIAnalysis}
            className="flex items-center gap-2 px-8 py-3 bg-brand-primary text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-zinc-200"
          >
            <Brain size={16} /> IA Analisar
          </button>
        </div>
      </header>

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
        <div className="flex items-center gap-3 text-slate-800">
          <Landmark size={24} className="text-brand-primary" />
          <h3 className="text-2xl font-light tracking-tight">Resumo do <span className="font-bold">Mês Atual</span></h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-green-500">Entradas</p>
            <p className="text-4xl font-light tracking-tighter text-slate-800">
              <span className="text-lg opacity-30 mr-1">R$</span> {monthTotals.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">Saídas</p>
            <p className="text-4xl font-light tracking-tighter text-slate-800">
              <span className="text-lg opacity-30 mr-1">R$</span> {monthTotals.expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-6 bg-slate-50 rounded-[2rem] space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Saldo Líquido</p>
            <p className={cn(
              "text-4xl font-bold tracking-tighter",
              monthBalance >= 0 ? "text-brand-primary" : "text-brand-accent"
            )}>
              <span className="text-lg opacity-30 mr-1">R$</span> {monthBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </section>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="adhd-card !bg-[#1A1A1A] text-white p-8 space-y-4 rounded-[2.5rem]">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Renda Acumulada</p>
          <div className="text-3xl font-light tracking-tighter">
            <span className="opacity-30 italic mr-1 text-xl">R$</span> {totals.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="adhd-card p-8 space-y-4 rounded-[2.5rem] border-brand-accent/20">
          <p className="text-[10px] uppercase tracking-widest text-brand-accent font-bold">Contas Pendentes</p>
          <div className="text-3xl font-light tracking-tighter text-brand-accent">
            <span className="opacity-30 italic mr-1 text-xl">R$</span> {totals.bills.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="adhd-card p-8 bg-zinc-50 border-brand-border space-y-4 rounded-[2.5rem]">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Dívida Estrutural</p>
          <div className="text-3xl font-light tracking-tighter text-slate-800">
            <span className="opacity-30 italic mr-1 text-xl">R$</span> {totals.structuralDebt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30">Lançamentos</h3>
          <button 
            onClick={() => setIsAddRecord(true)}
            className="text-[10px] font-bold uppercase tracking-widest text-brand-primary flex items-center gap-1 hover:underline underline-offset-8"
          >
            <Plus size={14} /> Novo Lançamento
          </button>
        </div>

        <div className="space-y-4">
          {records.length > 0 ? records.sort((a,b) => (a.status === 'pending' ? -1 : 1)).map(rec => (
            <div key={rec.id} className={cn(
              "task-card p-6 flex justify-between items-center group bg-white",
              rec.status === 'paid' || rec.status === 'received' ? "opacity-50" : ""
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
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                      {rec.type === 'income' ? 'Carga Horária / Entrega' : 'Vencimento'} • {rec.dueDate || 'N/A'}
                    </p>
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
          <div className="flex items-center gap-2 opacity-30">
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
          {loans.map(loan => (
            <div key={loan.id} className="adhd-card p-6 bg-white border-brand-border space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-bold tracking-tight text-slate-700">{loan.description}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Parcela: R$ {loan.monthlyAmount.toLocaleString('pt-BR')}</p>
                </div>
                <button onClick={() => deleteLoan(loan.id)} className="text-slate-200 hover:text-brand-accent transition-colors"><X size={16}/></button>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-brand-primary">Progresso Pagamento</span>
                  <span className="text-slate-400">{loan.paidInstallments} / {loan.totalInstallments}</span>
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
          <div className="flex items-center gap-2 opacity-30">
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
          {investments.map(inv => (
            <div key={inv.id} className="adhd-card p-6 bg-[#1A1A1A] text-white border-white/5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-brand-primary">
                    <Star size={12} className="fill-current" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em]">{inv.type === 'capitalization' ? 'Capitalização' : 'Cofrinho'}</span>
                  </div>
                  <h4 className="text-lg font-bold tracking-tight">{inv.description}</h4>
                </div>
                <button onClick={() => deleteInvestment(inv.id)} className="text-white/20 hover:text-white transition-colors"><X size={16}/></button>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Saldo Acumulado</p>
                  <p className="text-3xl font-light tracking-tighter">
                    <span className="text-sm opacity-30 mr-1">R$</span>{inv.amount.toLocaleString('pt-BR')}
                  </p>
                </div>
                {inv.monthlyContribution && (
                  <div className="text-right">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Contribuição</p>
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
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{item.day}</p>
              <p className="text-sm font-medium text-slate-700 tracking-tight leading-snug">{item.task}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Impulse Check Trigger */}
       <div className="pt-8">
        <button 
          onClick={() => setIsImpulseCheck(true)}
          className="w-full py-8 bg-white border-2 border-brand-accent text-brand-accent rounded-[3rem] font-bold uppercase tracking-[0.3em] text-sm hover:bg-brand-accent hover:text-white transition-all shadow-xl shadow-red-50 flex items-center justify-center gap-3 group"
        >
          <Shield size={20} className="group-hover:animate-bounce" />
          Evitar Gasto Impulsivo
        </button>
      </div>

      <AnimatePresence>
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
