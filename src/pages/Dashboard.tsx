import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, query, where, limit, onSnapshot, doc, getDoc, updateDoc, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, ArrowRight, Sparkles, Brain, Coffee, Zap, Wallet, GraduationCap, ShieldCheck, Loader2, Plus, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Task, UserProfile, CortexResponse, CortexInput, DailyCommitment } from '../types';
import { getCortexResponse } from '../services/cortexService';

export default function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cortex, setCortex] = useState<CortexResponse | null>(null);
  const [loadingCortex, setLoadingCortex] = useState(false);
  const [habits, setHabits] = useState<any[]>([]);
  const [commitment, setCommitment] = useState<DailyCommitment | null>(null);
  const [dailyPhrase, setDailyPhrase] = useState("Você não é preguiçoso. Seu cérebro só funciona diferente.");
  const [isCrisisMode, setIsCrisisMode] = useState(false);
  const [energyChecked, setEnergyChecked] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [survivalAlerts, setSurvivalAlerts] = useState<string[]>([]);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const handleActivity = () => setLastActivity(Date.now());
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const idleCheck = setInterval(() => {
      const idleTime = (Date.now() - lastActivity) / (1000 * 60);
      if (idleTime > 15 && !cortex && !loadingCortex) {
        triggerCortex('abrir_app');
      }
    }, 1000 * 60);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(idleCheck);
    };
  }, [lastActivity, cortex, loadingCortex]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const authId = auth.currentUser.uid;
    const today = new Date().toISOString().split('T')[0];

    // Routine Alert Logic
    const checkRoutineAlerts = () => {
      const now = new Date();
      const hour = now.getHours();
      const alerts = [];
      
      if (profile?.role === 'professor') {
        if (hour >= 7 && hour <= 12) alerts.push("📋 Período de Aula: Já conferiu o material?");
        if (hour >= 13 && hour <= 15) alerts.push("📝 Hora da Correção/Planejamento");
      }

      if (profile?.secondaryRole === 'motoboy') {
        if (hour >= 11 && hour <= 14) alerts.push("🛵 Horário de Pico: Água e Segurança!");
      }

      setSurvivalAlerts(alerts);
    };

    const qTasks = query(
      collection(db, 'tasks'),
      where('userId', '==', authId),
      where('completed', '==', false),
      orderBy('priorityIndex', 'asc'),
      limit(1)
    );

    const qHabits = query(
      collection(db, 'habits'),
      where('userId', '==', authId),
      where('type', '==', 'ADAPTIVE'),
      limit(1)
    );

    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });

    const unsubHabits = onSnapshot(qHabits, (snapshot) => {
      setHabits(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    const qCommitment = query(
      collection(db, 'commitments'), 
      where('userId', '==', authId),
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

    const unsubProfile = onSnapshot(doc(db, 'users', authId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        setIsCrisisMode(!!data.crisisMode);
        
        if (!hasTriggeredRef.current) {
          if (data.lastActiveDate && data.lastActiveDate !== today) {
            const lastDate = new Date(data.lastActiveDate);
            const diffDays = Math.floor((new Date(today).getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays >= 2) {
               setShowWelcomeBack(true);
               triggerCortex('retorno');
            }
          }
          hasTriggeredRef.current = true;
        }
        updateDoc(doc(db, 'users', authId), { lastActiveDate: today });
      }
    });

    checkRoutineAlerts();
    return () => {
      unsubTasks();
      unsubHabits();
      unsubCommitment();
      unsubProfile();
    };
  }, [profile?.role]);

  const triggerCortex = async (tipo: CortexInput['tipo_evento'], customTask?: string) => {
    if (!auth.currentUser || loadingCortex) return;
    setLoadingCortex(true);
    const input: CortexInput = {
      energia: profile?.energyLevel || 'medium',
      estado_emocional: isCrisisMode ? 'crise' : 'ok',
      tentativas_falha: 0, 
      tempo_inativo_min: 0,
      tipo_evento: tipo,
      tarefa: customTask || tasks[0]?.content || habits[0]?.title || "Nenhuma tarefa ativa"
    };

    try {
      const response = await getCortexResponse(input);
      setCortex(response);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCortex(false);
    }
  };

  const toggleCrisis = async () => {
    if (!auth.currentUser) return;
    const newMode = !isCrisisMode;
    setIsCrisisMode(newMode);
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { crisisMode: newMode });
    if (newMode) triggerCortex('crise');
  };

  const setEnergy = async (level: 'low' | 'medium' | 'high') => {
    if (!auth.currentUser) return;
    setEnergyChecked(true);
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { energyLevel: level });
  };

  const toggleCommitment = async () => {
    if (!commitment || !auth.currentUser) return;
    await updateDoc(doc(db, 'commitments', commitment.id), {
      isCompleted: !commitment.isCompleted
    });
  };

  const simplifyTask = async (task: Task) => {
    setLoadingCortex(true);
    const input: CortexInput = {
      energia: profile?.energyLevel || 'medium',
      estado_emocional: isCrisisMode ? 'crise' : 'travado',
      tentativas_falha: (task.reductionLevel || 0) + 1,
      tempo_inativo_min: 0,
      tipo_evento: 'nao_consegui',
      tarefa: task.content
    };

    try {
      const response = await getCortexResponse(input);
      setCortex(response);
      if (response.acao) {
        await updateDoc(doc(db, 'tasks', task.id), { 
          originalContent: task.originalContent || task.content,
          content: response.acao,
          reductionLevel: (task.reductionLevel || 0) + 1
        });
      }
    } finally {
      setLoadingCortex(false);
    }
  };

  const toggleHabit = async (habit: any) => {
    const today = new Date().toISOString().split('T')[0];
    const isCompleted = habit.completedDates.includes(today);
    let newDates = [...habit.completedDates];
    let updateData: any = {};
    if (isCompleted) {
      newDates = newDates.filter(d => d !== today);
    } else {
      newDates.push(today);
      if (habit.steps && habit.currentStepIndex !== undefined) {
        const nextIdx = Math.min(habit.steps.length - 1, habit.currentStepIndex + 1);
        updateData.currentStepIndex = nextIdx;
      }
    }
    updateData.completedDates = newDates;
    await updateDoc(doc(db, 'habits', habit.id), updateData);
  };

  const toggleTask = async (task: Task) => {
    await updateDoc(doc(db, 'tasks', task.id), {
      completed: !task.completed
    });
    if (!task.completed) setCortex(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-24">
      <AnimatePresence>
        {isCrisisMode && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-8 text-center space-y-12"
          >
            <div className="space-y-4">
               <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500 animate-pulse">
                  <AlertCircle size={48} />
               </div>
               <h2 className="text-5xl font-light tracking-tight">Respira.</h2>
               <p className="text-slate-400 text-xl font-light">Não precisa fazer tudo agora.</p>
            </div>

            <div className="bg-slate-50 p-12 rounded-[3.5rem] border border-slate-100 space-y-8 w-full max-w-lg">
               <div className="space-y-2">
                 <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400">Só faz isso:</p>
                 <h3 className="text-4xl font-bold tracking-tight text-slate-800">
                   {tasks[0]?.content || "Abrir o sistema"}
                 </h3>
               </div>
               <button 
                 onClick={() => toggleTask(tasks[0] || { id: 'temp' } as Task)}
                 className="w-full bg-[#1A1A1A] text-white py-8 rounded-[2rem] font-bold uppercase tracking-[0.2em] text-sm shadow-2xl"
               >
                 OK, CONCLUÍ
               </button>
            </div>

            <button onClick={toggleCrisis} className="text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-slate-900">
              Estou me sentindo melhor agora
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcomeBack && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-brand-primary text-white p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-6">
               <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Sparkles size={32} />
               </div>
               <div className="space-y-1 text-center md:text-left">
                  <h2 className="text-2xl font-bold tracking-tight">Você voltou.</h2>
                  <p className="text-white/80">Vamos daqui: uma coisa simples para começar.</p>
               </div>
            </div>
            <button onClick={() => setShowWelcomeBack(false)} className="px-10 py-4 bg-white text-brand-primary rounded-2xl font-bold uppercase tracking-widest text-[10px]">
              Vamos lá
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex justify-between items-center px-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-light tracking-tight">
            Olá, <span className="font-semibold">{profile?.name || 'Cérebro'}</span>
          </h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Foco Ativo</p>
        </div>
        <button onClick={toggleCrisis} className="px-6 py-3 rounded-xl text-[10px] font-bold bg-red-50 text-red-500 border border-red-100 uppercase tracking-widest">
          Não estou bem
        </button>
      </header>

      <section className="px-4">
        {(tasks.length > 0 || habits.length > 0) ? (
          <motion.div 
            layout
            className="bg-white p-12 rounded-[4rem] shadow-2xl border-2 border-brand-primary/10 space-y-10 relative overflow-hidden"
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-brand-primary">
                <Zap size={16} className="animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Próxima Ação Prioritária</span>
              </div>
              <h2 className="text-6xl font-light tracking-tighter leading-[0.9] text-slate-800">
                Faça isso agora: <br />
                <span className="font-bold underline decoration-brand-primary/20 break-words block mt-4">
                  {tasks[0]?.content || habits[0]?.steps?.[habits[0].currentStepIndex || 0]?.label}
                </span>
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => tasks[0] ? toggleTask(tasks[0]) : toggleHabit(habits[0])}
                className="w-full bg-[#1A1A1A] text-white py-10 rounded-[2.5rem] shadow-2xl font-bold uppercase tracking-[0.3em] text-base"
              >
                <CheckCircle2 size={24} className="inline mr-2" /> Começar & Concluir
              </button>
              <button 
                onClick={() => tasks[0] && simplifyTask(tasks[0])}
                className="w-full py-6 rounded-[2rem] bg-slate-50 text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]"
              >
                [ Não consegui ]
              </button>
            </div>

            {cortex && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-brand-primary/5 p-8 rounded-[2.5rem] flex items-start gap-4">
                  <Brain size={24} className="text-brand-primary shrink-0" />
                  <div className="space-y-1">
                    {cortex.mensagens.map((m, i) => <p key={i} className="text-lg text-slate-600 font-light">{m}</p>)}
                  </div>
               </motion.div>
            )}
          </motion.div>
        ) : (
          <div className="bg-zinc-50 border-2 border-dashed border-slate-100 p-20 rounded-[4rem] text-center">
            <Coffee size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-xl font-light text-slate-400">Tudo limpo. Descanse.</p>
          </div>
        )}
      </section>

      {!isCrisisMode && (
        <div className="space-y-10">
          {!energyChecked && (
            <div className="px-4">
              <div className="bg-zinc-900 p-8 rounded-[3rem] text-white flex items-center justify-between">
                <p className="text-sm font-light opacity-80">Como está sua energia?</p>
                <div className="flex gap-2">
                  {['low', 'medium', 'high'].map(l => (
                    <button key={l} onClick={() => setEnergy(l as any)} className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center capitalize">{l[0]}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="px-4">
            <section className="bg-white border border-brand-border p-8 rounded-[3rem] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", commitment?.isCompleted ? "bg-green-500 text-white" : "bg-slate-50 text-slate-300")}>
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Compromisso</p>
                  <p className={cn("text-lg font-bold", commitment?.isCompleted && "line-through opacity-30")}>{commitment?.microHabit || "Defina seu alvo"}</p>
                </div>
              </div>
              {!commitment?.isCompleted && <button onClick={toggleCommitment} className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">Concluir</button>}
            </section>
          </div>

          <div className="px-4 pb-12">
             <button onClick={() => navigate('/cerebelo')} className="w-full bg-slate-50 p-6 rounded-2xl flex items-center justify-between text-slate-400 border border-transparent hover:border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-widest">Ferramentas Secundárias</span>
                <ChevronRight size={16} />
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
