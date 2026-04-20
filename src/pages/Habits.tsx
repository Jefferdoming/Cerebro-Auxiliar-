import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, limit } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Shield, Zap, Sun, Plus, CheckCircle2, ChevronRight, Moon, Flame, Target, MessageSquareCode, Loader2 } from 'lucide-react';
import { DailyCommitment } from '../types';

interface Habit {
  id: string;
  title: string;
  type: 'SAVERS' | 'MICRO';
  completedDates: string[];
  streak: number;
}

export default function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [activeType, setActiveType] = useState<'SAVERS' | 'MICRO'>('MICRO');
  const [commitment, setCommitment] = useState<DailyCommitment | null>(null);
  const [isSavingCommitment, setIsSavingCommitment] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!auth.currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    
    // Habits subscription
    const qHabits = query(collection(db, 'habits'), where('userId', '==', auth.currentUser.uid));
    const unsubHabits = onSnapshot(qHabits, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Habit[];
      setHabits(list);
    });

    // Daily commitment subscription
    const qCommitment = query(
      collection(db, 'commitments'), 
      where('userId', '==', auth.currentUser.uid),
      where('date', '==', today),
      limit(1)
    );
    const unsubCommitment = onSnapshot(qCommitment, (snapshot) => {
      if (!snapshot.empty) {
        setCommitment({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as DailyCommitment);
      } else {
        setCommitment(null);
      }
    });

    return () => {
      unsubHabits();
      unsubCommitment();
    };
  }, []);

  const saveCommitment = async (data: Partial<DailyCommitment>) => {
    if (!auth.currentUser) return;
    setIsSavingCommitment(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      if (commitment) {
        await updateDoc(doc(db, 'commitments', commitment.id), data);
      } else {
        await addDoc(collection(db, 'commitments'), {
          userId: auth.currentUser.uid,
          date: today,
          microHabit: data.microHabit || '',
          isCompleted: data.isCompleted || false,
          reflection: data.reflection || '',
          createdAt: serverTimestamp()
        });
      }
    } finally {
      setIsSavingCommitment(false);
    }
  };

  const addHabit = async (type: 'SAVERS' | 'MICRO', customTitle?: string) => {
    if (!auth.currentUser) return;
    const title = customTitle || newHabit;
    if (!title.trim()) return;

    await addDoc(collection(db, 'habits'), {
      userId: auth.currentUser.uid,
      title,
      type,
      completedDates: [],
      streak: 0,
      createdAt: serverTimestamp()
    });
    setNewHabit('');
  };

  const toggleHabit = async (habit: Habit) => {
    const isCompleted = habit.completedDates.includes(today);
    let newDates = [...habit.completedDates];
    
    if (isCompleted) {
      newDates = newDates.filter(d => d !== today);
    } else {
      newDates.push(today);
    }

    await updateDoc(doc(db, 'habits', habit.id), {
      completedDates: newDates,
      streak: isCompleted ? Math.max(0, habit.streak - 1) : habit.streak + 1
    });
  };

  const saversTemplates = [
    { title: "Silêncio (Meditação)", desc: "5 minutos de silêncio absoluto." },
    { title: "Afirmações", desc: "Diga em voz alta seus objetivos." },
    { title: "Visualização", desc: "Imagine seu dia perfeito acontecendo." },
    { title: "Exercício", desc: "60 segundos de polichinelos ou alongamento." },
    { title: "Leitura", desc: "Leia 2 páginas de um livro físico." },
    { title: "Escrita (Diário)", desc: "Escreva 3 coisas pelas quais é grato." }
  ];

  const effectiveTemplates = [
    { title: "Ser Proativo", desc: "Assuma o controle da sua resposta aos estímulos." },
    { title: "Começar com o Fim em Mente", desc: "Tenha clareza do seu objetivo final." },
    { title: "Primeiro o Mais Importante", desc: "Foque no Urgente vs Importante." },
    { title: "Pensar Ganha-Ganha", desc: "Busque soluções mutuamente benéficas." },
    { title: "Compreender para ser Compreendido", desc: "Escuta empática antes de falar." },
    { title: "Criar Sinergia", desc: "O todo é maior que a soma das partes." },
    { title: "Afiar o Machado", desc: "Auto-renovação física e mental." }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="space-y-4">
        <h1 className="text-5xl font-light tracking-tight">Arquitetura de <span className="font-bold whitespace-nowrap">Hábitos</span></h1>
        <div className="flex items-center justify-between border-b border-black/5 pb-8 mb-4">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest leading-relaxed">
            Hábitos Atômicos & Eficácia Real. <br />Pequenas vitórias, grandes destinos.
          </p>
        </div>
      </header>

      {/* Daily Strategic Commitment Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="adhd-card !bg-white !p-10 border-brand-border space-y-8 shadow-xl shadow-slate-100/50">
          <div className="flex items-center gap-3 text-brand-primary">
            <Target size={24} className="animate-pulse" />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em]">Compromisso Atômico (Hoje)</h2>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-slate-400 font-medium">Qual a <strong>única</strong> micro-ação irredutível que você fará hoje?</p>
            <div className="flex gap-4">
              <input 
                type="text"
                placeholder="Ex: Ler 1 página, 1 flexão, beber 1 copo d'água..."
                className="flex-1 bg-zinc-50 p-4 rounded-2xl border border-brand-border outline-none focus:border-brand-primary text-lg tracking-tight"
                value={commitment?.microHabit || ''}
                onChange={(e) => setCommitment(prev => prev ? { ...prev, microHabit: e.target.value } : { microHabit: e.target.value } as any)}
                onBlur={(e) => saveCommitment({ microHabit: e.target.value })}
              />
              <button 
                onClick={() => saveCommitment({ isCompleted: !commitment?.isCompleted })}
                className={cn(
                  "p-4 rounded-2xl transition-all shadow-lg active:scale-95",
                  commitment?.isCompleted ? "bg-green-500 text-white" : "bg-slate-100 text-slate-300"
                )}
              >
                <CheckCircle2 size={24} />
              </button>
            </div>
            <p className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">Autofoco: Menos de 2 minutos para concluir.</p>
          </div>
        </div>

        <div className="adhd-card !bg-[#1A1A1A] text-white !p-10 space-y-8 shadow-2xl">
          <div className="flex items-center gap-3 text-brand-warning">
            <MessageSquareCode size={24} />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em]">Começar com o Fim em Mente</h2>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-white/50 font-medium">Como essa ação de hoje te aproxima do seu destino final?</p>
            <textarea 
              rows={3}
              placeholder="Reflexão: Minha ação de hoje gera a identidade de alguém que..."
              className="w-full bg-white/5 border border-white/10 p-5 rounded-[2rem] outline-none focus:border-brand-primary text-lg tracking-tight resize-none placeholder:text-white/10"
              value={commitment?.reflection || ''}
              onChange={(e) => setCommitment(prev => prev ? { ...prev, reflection: e.target.value } : { reflection: e.target.value } as any)}
              onBlur={(e) => saveCommitment({ reflection: e.target.value })}
            />
            <div className="flex justify-between items-center">
              <p className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Visão de Longo Prazo</p>
              {isSavingCommitment && <Loader2 size={12} className="animate-spin text-brand-primary" />}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Habits List */}
        <section className="lg:col-span-12 space-y-10">
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
          <button 
            onClick={() => setActiveType('MICRO')}
            className={cn(
              "whitespace-nowrap px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
              activeType === 'MICRO' ? "bg-brand-primary text-white" : "bg-white text-slate-400 border border-brand-border"
            )}
          >
            Micro-Hábitos
          </button>
          <button 
            onClick={() => setActiveType('SAVERS')}
            className={cn(
              "whitespace-nowrap px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
              activeType === 'SAVERS' ? "bg-brand-primary text-white" : "bg-white text-slate-400 border border-brand-border"
            )}
          >
            O Milagre da Manhã
          </button>
          <button 
            onClick={() => setActiveType('EFFECTIVE' as any)}
            className={cn(
              "whitespace-nowrap px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
              (activeType as string) === 'EFFECTIVE' ? "bg-brand-primary text-white" : "bg-white text-slate-400 border border-brand-border"
            )}
          >
            7 Hábitos (Covey)
          </button>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* List */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30">Seus Hábitos Ativos</h3>
              <div className="space-y-3">
                {habits.filter(h => h.type === activeType).map((habit) => (
                  <motion.div 
                    layout
                    key={habit.id}
                    className="task-card p-6 flex justify-between items-center group bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => toggleHabit(habit)}
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                          habit.completedDates.includes(today) ? "bg-green-500 text-white" : "border-2 border-slate-100 text-transparent"
                        )}
                      >
                        <CheckCircle2 size={20} />
                      </button>
                      <div>
                        <p className={cn(
                          "text-lg font-medium tracking-tight",
                          habit.completedDates.includes(today) ? "text-slate-300 line-through" : "text-slate-700"
                        )}>
                          {habit.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Flame size={12} className={habit.streak > 0 ? "text-orange-500" : "text-slate-200"} />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{habit.streak} dias seguidos</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {activeType === 'MICRO' && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Criar micro-hábito (ex: 1 flexão)"
                      className="flex-1 bg-white p-4 rounded-2xl border border-brand-border outline-none focus:border-brand-primary text-sm tracking-tight"
                      value={newHabit}
                      onChange={(e) => setNewHabit(e.target.value)}
                    />
                    <button 
                      onClick={() => addHabit('MICRO')}
                      className="bg-brand-primary text-white p-4 rounded-2xl shadow-xl transition-all active:scale-95"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Templates for SAVERS */}
            {activeType === 'SAVERS' && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30">Instruções S.A.V.E.R.S</h3>
                <div className="grid grid-cols-1 gap-3">
                  {saversTemplates.map((template) => (
                    <div 
                      key={template.title}
                      className="adhd-card !p-5 bg-zinc-50 border-brand-border flex items-center justify-between group cursor-pointer hover:bg-white"
                      onClick={() => addHabit('SAVERS', template.title)}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-800 uppercase tracking-tight">{template.title}</p>
                        <p className="text-xs text-slate-400 font-medium">{template.desc}</p>
                      </div>
                      <Plus size={16} className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-primary" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Templates for EFFECTIVE */}
            {(activeType as string) === 'EFFECTIVE' && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30">Os 7 Hábitos Eficazes</h3>
                <div className="grid grid-cols-1 gap-3">
                  {effectiveTemplates.map((template) => (
                    <div 
                      key={template.title}
                      className="adhd-card !p-5 bg-[#1A1A1A] border-white/5 flex items-center justify-between group cursor-pointer hover:bg-black"
                      onClick={() => addHabit('MICRO', template.title)}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white uppercase tracking-tight">{template.title}</p>
                        <p className="text-xs text-slate-500 font-medium">{template.desc}</p>
                      </div>
                      <Plus size={16} className="opacity-0 group-hover:opacity-100 transition-opacity text-brand-primary" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeType === 'MICRO' && (
              <div className="bg-zinc-50 border border-brand-border p-8 rounded-[3rem] space-y-6">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-brand-primary shadow-sm">
                  <Zap size={32} />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary opacity-40">Ciência do Hábito</p>
                  <p className="text-xl font-medium text-slate-600 tracking-tight leading-relaxed">
                    "O segredo do sucesso está no que você faz repetidamente. Se um hábito é difícil de começar, torne-o ridiculamente pequeno."
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
