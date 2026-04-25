import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Pill, Sun, Moon, Coffee, BookOpen, Clock, CheckCircle2, Circle, Sparkles, Brain, Bell, BellOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { NotificationService } from '../services/notificationService';

interface RoutineState {
  medication: {
    morning: boolean;
    afternoon: boolean;
    night: boolean;
    lastNoted: string;
  };
  times: {
    morning: string;
    afternoon: string;
    night: string;
  };
  completedSteps?: {
    [date: string]: {
      morning: string[];
      night: string[];
    };
  };
}

export default function Routine() {
  const [routine, setRoutine] = useState<RoutineState | null>(null);
  const [activeRitual, setActiveRitual] = useState<'morning' | 'night'>('morning');
  const [showCelebration, setShowCelebration] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    NotificationService.getPermissionStatus() as any
  );

  const isIframe = window.self !== window.top;

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!auth.currentUser) return;
    const routineRef = doc(db, 'routines', auth.currentUser.uid);
    
    const unsub = onSnapshot(routineRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as RoutineState;
        if (data.medication.lastNoted !== today) {
          const resetData = {
            ...data,
            medication: { morning: false, afternoon: false, night: false, lastNoted: today },
            completedSteps: data.completedSteps || {}
          };
          // Ensure today's entries exist in completedSteps
          if (!resetData.completedSteps?.[today]) {
            resetData.completedSteps = {
              ...resetData.completedSteps,
              [today]: { morning: [], night: [] }
            };
          }
          setDoc(routineRef, resetData);
        } else {
          setRoutine(data);
        }
      } else {
        const initial = {
          medication: { morning: false, afternoon: false, night: false, lastNoted: today },
          times: { morning: "07:00", afternoon: "13:00", night: "21:00" },
          completedSteps: {
            [today]: { morning: [], night: [] }
          }
        };
        setDoc(routineRef, initial);
      }
    });

    return unsub;
  }, [today]);

  const toggleStep = async (ritual: 'morning' | 'night', stepId: string) => {
    if (!auth.currentUser || !routine) return;
    const routineRef = doc(db, 'routines', auth.currentUser.uid);
    const currentSteps = routine.completedSteps?.[today]?.[ritual] || [];
    const newSteps = currentSteps.includes(stepId) 
      ? currentSteps.filter(id => id !== stepId)
      : [...currentSteps, stepId];

    const rituals = {
      morning: [
        { id: "m1", act: "Água + Medicação" },
        { id: "m2", act: "Exposição Solar (5 min)" },
        { id: "m3", act: "Café sem Celular" },
        { id: "m4", act: "Planejamento (3 Objetivos)" },
      ],
      night: [
        { id: "n1", act: "Desconexão Digital" },
        { id: "n2", act: "Organizar Roupa Amanhã" },
        { id: "n3", act: "Leitura / Escrita" },
        { id: "n4", act: "Sono Reparador" },
      ]
    };

    const isCompleted = newSteps.length === rituals[ritual].length;

    await updateDoc(routineRef, {
      [`completedSteps.${today}.${ritual}`]: newSteps
    });

    if (isCompleted && !currentSteps.includes(stepId)) {
      setShowCelebration(true);
      // Save history entry
      const historyId = `${auth.currentUser.uid}_${today}_${ritual}`;
      await setDoc(doc(db, 'routine_history', historyId), {
        userId: auth.currentUser.uid,
        date: today,
        ritualType: ritual,
        completedAt: new Date(),
        steps: newSteps
      });
      setTimeout(() => setShowCelebration(false), 3000);
    }
  };

  const handleRequestNotifs = async () => {
    const granted = await NotificationService.requestPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    
    if (!granted && isIframe) {
      alert("Para ativar as notificações aqui dentro, você precisa abrir o app em uma aba separada (ícone de seta no canto superior direito), pois navegadores bloqueiam pedidos de notificação dentro de sites embutidos (iframes).");
    }
  };

  const toggleMed = async (period: 'morning' | 'afternoon' | 'night') => {
    if (!auth.currentUser || !routine) return;
    const routineRef = doc(db, 'routines', auth.currentUser.uid);
    await updateDoc(routineRef, {
      [`medication.${period}`]: !routine.medication[period]
    });
  };

  const updateTime = async (period: 'morning' | 'afternoon' | 'night', time: string) => {
    if (!auth.currentUser || !routine) return;
    const routineRef = doc(db, 'routines', auth.currentUser.uid);
    await updateDoc(routineRef, {
      [`times.${period}`]: time
    });
  };

  const rituals = {
    morning: [
      { id: "m1", time: "07:00", act: "Água + Medicação", icon: Pill },
      { id: "m2", time: "07:15", act: "Exposição Solar (5 min)", icon: Sun },
      { id: "m3", time: "07:30", act: "Café sem Celular", icon: Coffee },
      { id: "m4", time: "08:00", act: "Planejamento (3 Objetivos)", icon: BookOpen },
    ],
    night: [
      { id: "n1", time: "21:00", act: "Desconexão Digital", icon: Moon },
      { id: "n2", time: "21:30", act: "Organizar Roupa Amanhã", icon: Pill },
      { id: "n3", time: "22:00", act: "Leitura / Escrita", icon: BookOpen },
      { id: "n4", time: "22:30", act: "Sono Reparador", icon: Clock },
    ]
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24 relative">
      <AnimatePresence>
        {showCelebration && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-brand-primary text-white p-12 rounded-[4rem] shadow-2xl text-center space-y-4 border-4 border-white/20 backdrop-blur-xl">
              <Sparkles size={64} className="mx-auto animate-pulse" />
              <h2 className="text-4xl font-bold tracking-tight">Ritual Concluído!</h2>
              <p className="text-white/80 font-medium">Seu cérebro agradece pela consistência.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-4">
        <div className="space-y-4">
          <h1 className="text-5xl font-light tracking-tight">Ritual <span className="font-bold">Diário</span></h1>
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest">
            A estrutura que liberta seu cérebro.
          </p>
        </div>
        
        <button 
          onClick={handleRequestNotifs}
          className={cn(
            "flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all",
            notifPermission === 'granted' 
              ? "bg-green-50 text-green-600 border border-green-100" 
              : notifPermission === 'denied'
                ? "bg-red-50 text-red-500 border border-red-100"
                : "bg-brand-primary/10 text-brand-primary border border-brand-primary/20 hover:bg-brand-primary hover:text-white"
          )}
        >
          {notifPermission === 'granted' ? (
            <> <Bell size={14} /> Lembretes Ativos </>
          ) : notifPermission === 'denied' ? (
            <> <BellOff size={14} /> Bloqueado / Usar Aba Separada </>
          ) : notifPermission === 'unsupported' ? (
            <> <BellOff size={14} /> Não suportado </>
          ) : (
            <> <BellOff size={14} /> Ativar Lembretes </>
          )}
        </button>
      </header>

      <div className="border-b border-black/5 mx-4" />

      {/* Medication Integration */}
      <section className="adhd-card !bg-[#1A1A1A] text-white p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
        <div className="absolute -right-10 -bottom-10 opacity-5 rotate-12 scale-150">
          <Pill size={200} />
        </div>
        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-3 text-brand-primary">
            <Sparkles size={20} />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em]">Gestão de Medicação</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(['morning', 'afternoon', 'night'] as const).map((period) => (
              <div key={period} className="space-y-4">
                <button 
                  onClick={() => toggleMed(period)}
                  className={cn(
                    "w-full p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-3 text-center",
                    routine?.medication[period] 
                      ? "bg-brand-primary border-transparent text-white shadow-lg" 
                      : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                  )}
                >
                  <Pill size={24} className={routine?.medication[period] ? "animate-bounce" : ""} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {period === 'morning' ? 'Manhã' : period === 'afternoon' ? 'Tarde' : 'Noite'}
                  </span>
                  {routine?.medication[period] && <div className="text-[8px] font-mono opacity-60">TOMADO</div>}
                </button>
                <div className="flex items-center justify-center gap-2 px-6">
                  <Clock size={12} className="text-slate-500" />
                  <input 
                    type="time" 
                    className="bg-transparent border-none text-[10px] font-bold uppercase tracking-widest text-slate-400 focus:text-brand-primary outline-none cursor-pointer"
                    value={routine?.times?.[period] || "00:00"}
                    onChange={(e) => updateTime(period, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ritual Blocks */}
      <section className="space-y-10">
        <div className="flex gap-4 p-1.5 bg-zinc-100 rounded-full w-fit">
          <button 
            onClick={() => setActiveRitual('morning')}
            className={cn(
              "px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
              activeRitual === 'morning' ? "bg-white shadow-sm text-black" : "text-slate-400"
            )}
          >
            Início do Dia
          </button>
          <button 
            onClick={() => setActiveRitual('night')}
            className={cn(
              "px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all",
              activeRitual === 'night' ? "bg-white shadow-sm text-black" : "text-slate-400"
            )}
          >
            Encerramento
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeRitual}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="contents"
            >
              {rituals[activeRitual].map((step, i) => {
                const isStepDone = routine?.completedSteps?.[today]?.[activeRitual]?.includes(step.id);
                return (
                  <div 
                    key={step.id} 
                    onClick={() => toggleStep(activeRitual, step.id)}
                    className={cn(
                      "task-card p-8 flex items-center gap-8 group cursor-pointer transition-all",
                      isStepDone ? "bg-zinc-50 border-transparent opacity-60" : "bg-white border-brand-border hover:shadow-lg"
                    )}
                  >
                    <div className="shrink-0">
                      {isStepDone ? (
                        <CheckCircle2 size={32} className="text-brand-primary" fill="currentColor" />
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-slate-200 group-hover:border-brand-primary transition-colors" />
                      )}
                    </div>
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center transition-all",
                      isStepDone ? "bg-white text-brand-primary" : "bg-zinc-50 text-slate-300 group-hover:text-brand-primary group-hover:bg-brand-primary/5"
                    )}>
                      <step.icon size={28} strokeWidth={1.5} />
                    </div>
                    <div className="flex-grow">
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">{step.time}</p>
                      <p className={cn(
                        "text-xl font-medium tracking-tight",
                        isStepDone ? "text-slate-400 line-through" : "text-slate-700"
                      )}>{step.act}</p>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* Advisory Note */}
      <div className="bg-zinc-50 p-10 rounded-[3rem] border border-brand-border flex gap-8 items-center">
        <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center text-brand-primary shadow-sm shrink-0">
          <Brain size={40} strokeWidth={1} />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-800">Nota UX do Cérebro</h4>
          <p className="text-lg font-medium text-slate-500 tracking-tight leading-relaxed">
            Seu cérebro odeia transições abrruptas. O ritual serve como um amortecedor emocional entre o sono e a alta demanda do magistério/entregas.
          </p>
        </div>
      </div>
    </div>
  );
}
