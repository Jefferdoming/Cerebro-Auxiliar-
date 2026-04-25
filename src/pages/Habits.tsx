import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, limit } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Shield, Zap, Sun, Plus, CheckCircle2, ChevronRight, Moon, Flame, Target, MessageSquareCode, Loader2, Trash2, AlertCircle } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { DailyCommitment, Habit, CortexInput, HabitStep } from '../types';
import { getCortexResponse } from '../services/cortexService';

const MODEL_NAME = "gemini-3-flash-preview";

export default function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [activeType, setActiveType] = useState<'SAVERS' | 'MICRO' | 'EFFECTIVE' | 'ADAPTIVE'>('ADAPTIVE');
  const [commitment, setCommitment] = useState<DailyCommitment | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSavingCommitment, setIsSavingCommitment] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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

  const generateHabitPlan = async (habitTitle: string) => {
    const prompt = `Você é um especialista em TDAH e formação de hábitos. 
    O usuário quer criar o hábito: "${habitTitle}".
    Crie um plano de 5 micro-ações progressivas, começando pelo NÍVEL UM (mínimo esforço ridículo).
    Exemplo para Academia: 
    Nível 1: Separar a roupa. 
    Nível 2: Colocar a roupa. 
    Nível 3: Ir até a porta da academia.
    Nível 4: Entrar e ficar 5 min.
    Nível 5: Fazer 1 exercício.

    Retorne APENAS um JSON no formato:
    {
      "steps": [
        {"label": "Texto da micro-ação", "level": 1},
        ...
      ]
    }
    Use linguagem direta, humana e motivadora para TDAH.`;

    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    try {
      const data = JSON.parse(result.text || '{}');
      return (data.steps || []).map((s: any, i: number) => ({ ...s, id: `step-${i}-${Date.now()}` }));
    } catch {
      return [
        { id: 'default-1', label: `Preparar-se para: ${habitTitle}`, level: 1 },
        { id: 'default-2', label: `Fazer 1 minuto de: ${habitTitle}`, level: 2 }
      ];
    }
  };

  const addHabit = async (type: 'SAVERS' | 'MICRO' | 'EFFECTIVE' | 'ADAPTIVE', customTitle?: string) => {
    if (!auth.currentUser) return;
    const title = customTitle || newHabit;
    if (!title.trim()) return;

    let steps = null;
    let currentStepIndex = null;
    let adaptiveLevel = null;

    if (type === 'ADAPTIVE') {
      setIsGeneratingPlan(true);
      try {
        steps = await generateHabitPlan(title);
        currentStepIndex = 0;
        adaptiveLevel = 1;
      } catch (err) {
        console.error("Erro ao gerar plano:", err);
      } finally {
        setIsGeneratingPlan(false);
      }
    }

    await addDoc(collection(db, 'habits'), {
      userId: auth.currentUser.uid,
      title,
      type,
      completedDates: [],
      streak: 0,
      steps,
      currentStepIndex,
      adaptiveLevel,
      createdAt: serverTimestamp()
    });
    setNewHabit('');
  };

  const generateReinforcement = async (habitTitle: string, stepLabel: string) => {
    const prompt = `Gere uma frase curta (máximo 10 palavras), humana e realista de reforço positivo para um usuário com TDAH que acabou de concluir a micro-ação: "${stepLabel}" do hábito "${habitTitle}". 
    Evite clichês exagerados. Seja direto e acolhedor (tom "Cérebro Auxiliar").`;
    
    const result = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt
    });
    return result.text || "Progresso real. Continue assim.";
  };

  const toggleHabit = async (habit: Habit) => {
    const isCompleted = habit.completedDates.includes(today);
    let newDates = [...habit.completedDates];
    let updateData: any = {};
    
    if (isCompleted) {
      newDates = newDates.filter(d => d !== today);
      updateData.streak = Math.max(0, habit.streak - 1);
    } else {
      newDates.push(today);
      updateData.streak = habit.streak + 1;
      
      if (habit.type === 'ADAPTIVE' && habit.steps && habit.currentStepIndex !== undefined) {
        const nextIdx = Math.min(habit.steps.length - 1, habit.currentStepIndex + 1);
        if (nextIdx > habit.currentStepIndex) {
          updateData.currentStepIndex = nextIdx;
          updateData.adaptiveLevel = habit.steps[nextIdx].level;
        }
        updateData.lastReinforcementMsg = await generateReinforcement(habit.title, habit.steps[habit.currentStepIndex].label);
      }
    }

    updateData.completedDates = newDates;
    await updateDoc(doc(db, 'habits', habit.id), updateData);
  };

  const reduceDifficulty = async (habit: Habit) => {
    const currentStepIndex = habit.currentStepIndex || 0;
    const currentStep = habit.steps?.[currentStepIndex];

    const input: CortexInput = {
      energia: 'medium', // Default for habits page
      estado_emocional: 'travado',
      tentativas_falha: 1,
      tempo_inativo_min: 0,
      tipo_evento: 'nao_consegui',
      tarefa: currentStep?.label || habit.title
    };

    try {
      const response = await getCortexResponse(input);
      if (response.acao) {
        const newStep: HabitStep = { 
          id: `reduced-${Date.now()}`, 
          label: response.acao, 
          level: Math.max(1, (currentStep?.level || 1) - 1) 
        };
        
        const newSteps = [...(habit.steps || [])];
        newSteps.splice(currentStepIndex, 0, newStep);

        await updateDoc(doc(db, 'habits', habit.id), {
          steps: newSteps,
          adaptiveLevel: newStep.level,
          lastFailureDate: today
        });
      }
    } catch (err) {
      console.error(err);
    }
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
            <div className="group relative ml-auto">
              <AlertCircle size={14} className="text-slate-300 cursor-help" />
              <div className="absolute right-0 top-6 w-64 bg-white p-4 rounded-2xl shadow-2xl border border-brand-border opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                <p className="text-[10px] font-bold uppercase text-brand-primary mb-2">💡 Como utilizar?</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  O compromisso atômico é a <strong>única</strong> ação que você se obriga a fazer hoje. <br/><br/>
                  Deve ser tão pequena (ex: beber 1 copo de água) que seu cérebro não consiga dar a desculpa de "falta de tempo". <br/><br/>
                  <strong>Meta:</strong> Provar para si mesmo que você tem controle sobre pelo menos uma coisa.
                </p>
              </div>
            </div>
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
            onClick={() => setActiveType('ADAPTIVE')}
            className={cn(
              "whitespace-nowrap px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
              activeType === 'ADAPTIVE' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "bg-white text-slate-400 border border-brand-border"
            )}
          >
            Foco TDAH (Adaptativo)
          </button>
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
            onClick={() => setActiveType('EFFECTIVE')}
            className={cn(
              "whitespace-nowrap px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
              activeType === 'EFFECTIVE' ? "bg-brand-primary text-white" : "bg-white text-slate-400 border border-brand-border"
            )}
          >
            7 Hábitos (Covey)
          </button>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Adaptive Habits - Focus View */}
            {activeType === 'ADAPTIVE' && (
              <div className="space-y-6 md:col-span-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Qual hábito você quer traduzir em ação? (ex: Ir à academia)"
                    className="flex-1 bg-white p-6 rounded-[2rem] border border-brand-border outline-none focus:border-brand-primary text-lg tracking-tight shadow-sm"
                    value={newHabit}
                    onChange={(e) => setNewHabit(e.target.value)}
                    disabled={isGeneratingPlan}
                  />
                  <button 
                    onClick={() => addHabit('ADAPTIVE')}
                    disabled={isGeneratingPlan || !newHabit.trim()}
                    className="bg-brand-primary text-white px-8 rounded-[2rem] shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
                  >
                    {isGeneratingPlan ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
                    <span className="hidden sm:inline font-bold uppercase text-[10px] tracking-widest">Criar Plano</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  {habits.filter(h => h.type === 'ADAPTIVE').map((habit) => {
                    const currentStep = habit.steps?.[habit.currentStepIndex || 0];
                    const isCompleted = habit.completedDates.includes(today);

                    return (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={habit.id}
                        className="bg-white border border-brand-border rounded-[3rem] p-10 space-y-8 shadow-sm relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-primary">{habit.title}</p>
                            <h4 className="text-3xl font-light tracking-tight text-slate-800">Próximo Passo:</h4>
                          </div>
                          {!isCompleted && (
                            <button 
                              onClick={() => reduceDifficulty(habit)}
                              className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-brand-accent transition-colors border border-slate-100 px-4 py-2 rounded-full"
                            >
                              Não consigo fazer
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-6">
                          <button 
                            onClick={() => toggleHabit(habit)}
                            className={cn(
                              "w-20 h-20 rounded-[2.5rem] flex items-center justify-center transition-all shadow-xl active:scale-90",
                              isCompleted ? "bg-green-500 text-white shadow-green-200" : "bg-slate-50 text-slate-200 border-2 border-slate-100 hover:border-brand-primary hover:text-brand-primary"
                            )}
                          >
                            <CheckCircle2 size={40} />
                          </button>
                          
                          <div className="flex-1">
                            <p className={cn(
                              "text-4xl font-bold tracking-tighter leading-none transition-all",
                              isCompleted ? "text-slate-300 line-through" : "text-slate-900"
                            )}>
                              {currentStep?.label || "Ação não gerada."}
                            </p>

                            {/* History UI for Adaptive Habits */}
                            <div className="flex items-center gap-4 mt-4">
                              <div className="flex gap-1">
                                {[6, 5, 4, 3, 2, 1, 0].map(daysAgo => {
                                  const d = new Date();
                                  d.setDate(d.getDate() - daysAgo);
                                  const dateStr = d.toISOString().split('T')[0];
                                  const wasCompleted = habit.completedDates.includes(dateStr);
                                  return (
                                    <div 
                                      key={dateStr}
                                      className={cn(
                                        "w-2 h-2 rounded-full",
                                        wasCompleted ? "bg-green-500" : "bg-slate-100"
                                      )}
                                    />
                                  );
                                })}
                              </div>
                              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">Consistência 7 dias</span>
                            </div>

                            {habit.lastReinforcementMsg && isCompleted && (
                              <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-3 text-sm font-medium text-green-600 italic"
                              >
                                "{habit.lastReinforcementMsg}"
                              </motion.p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-8 border-t border-slate-50">
                          <div className="flex gap-2">
                            {[1,2,3,4,5].map(lvl => (
                              <div 
                                key={lvl} 
                                className={cn(
                                  "w-12 h-1.5 rounded-full transition-all",
                                  (habit.adaptiveLevel || 0) >= lvl ? "bg-brand-primary" : "bg-slate-100"
                                )} 
                              />
                            ))}
                          </div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                             Nível de Dificuldade: {habit.adaptiveLevel || 1}/5
                          </p>
                        </div>

                        <button 
                          onClick={async () => {
                            if (confirm('Deseja excluir este plano?')) {
                              await deleteDoc(doc(db, 'habits', habit.id));
                            }
                          }}
                          className="absolute bottom-6 right-10 text-slate-200 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

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
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-2">
                            <Flame size={12} className={habit.streak > 0 ? "text-orange-500" : "text-slate-200"} />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{habit.streak} dias seguidos</span>
                          </div>
                          
                          {/* History Dots for previous accesses */}
                          <div className="flex gap-1 ml-2 border-l border-slate-100 pl-4">
                            {[6, 5, 4, 3, 2, 1, 0].map(daysAgo => {
                              const d = new Date();
                              d.setDate(d.getDate() - daysAgo);
                              const dateStr = d.toISOString().split('T')[0];
                              const wasCompleted = habit.completedDates.includes(dateStr);
                              return (
                                <div 
                                  key={dateStr}
                                  title={dateStr}
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full transition-all",
                                    wasCompleted ? "bg-green-500 scale-110" : "bg-slate-100"
                                  )}
                                />
                              );
                            })}
                          </div>
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
            {activeType === 'EFFECTIVE' && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30">Os 7 Hábitos Eficazes</h3>
                <div className="grid grid-cols-1 gap-3">
                  {effectiveTemplates.map((template) => (
                    <div 
                      key={template.title}
                      className="adhd-card !p-5 bg-[#1A1A1A] border-white/5 flex items-center justify-between group cursor-pointer hover:bg-black"
                      onClick={() => addHabit('EFFECTIVE', template.title)}
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

            {activeType === 'EFFECTIVE' && (
              <div className="bg-[#1A1A1A] p-8 rounded-[3rem] space-y-6 text-white shadow-2xl">
                <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-brand-warning">
                  <Shield size={32} />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-warning opacity-60">Mentalidade de Eficácia</p>
                  <p className="text-xl font-medium text-white/80 tracking-tight leading-relaxed">
                    Estes hábitos não são tarefas, são <span className="text-white font-bold">paradigmas</span>. Comece escolhendo um para focar por semana e observe como sua percepção de controle muda.
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
