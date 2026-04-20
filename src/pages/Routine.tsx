import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { Pill, Sun, Moon, Coffee, BookOpen, Clock, CheckCircle2, Circle, Sparkles, Brain } from 'lucide-react';
import { cn } from '../lib/utils';

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
}

export default function Routine() {
  const [routine, setRoutine] = useState<RoutineState | null>(null);
  const [activeRitual, setActiveRitual] = useState<'morning' | 'night'>('morning');

  useEffect(() => {
    if (!auth.currentUser) return;
    const routineRef = doc(db, 'routines', auth.currentUser.uid);
    
    const unsub = onSnapshot(routineRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as RoutineState;
        // Reset if it's a new day
        const today = new Date().toISOString().split('T')[0];
        if (data.medication.lastNoted !== today) {
          const resetData = {
            medication: { morning: false, afternoon: false, night: false, lastNoted: today },
            times: data.times || { morning: "07:00", afternoon: "13:00", night: "21:00" }
          };
          setDoc(routineRef, resetData);
        } else {
          setRoutine(data);
        }
      } else {
        const initial = {
          medication: { morning: false, afternoon: false, night: false, lastNoted: new Date().toISOString().split('T')[0] },
          times: { morning: "07:00", afternoon: "13:00", night: "21:00" }
        };
        setDoc(routineRef, initial);
      }
    });

    return unsub;
  }, []);

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
      { time: "07:00", act: "Água + Medicação", icon: Pill },
      { time: "07:15", act: "Exposição Solar (5 min)", icon: Sun },
      { time: "07:30", act: "Café sem Celular", icon: Coffee },
      { time: "08:00", act: "Planejamento (3 Objetivos)", icon: BookOpen },
    ],
    night: [
      { time: "21:00", act: "Desconexão Digital", icon: Moon },
      { time: "21:30", act: "Organizar Roupa Amanhã", icon: Pill },
      { time: "22:00", act: "Leitura / Escrita", icon: BookOpen },
      { time: "22:30", act: "Sono Reparador", icon: Clock },
    ]
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <header className="space-y-4">
        <h1 className="text-5xl font-light tracking-tight">Ritual <span className="font-bold">Diário</span></h1>
        <p className="text-sm font-medium text-slate-400 uppercase tracking-widest border-b border-black/5 pb-8">
          A estrutura que liberta seu cérebro.
        </p>
      </header>

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
              {rituals[activeRitual].map((step, i) => (
                <div key={i} className="task-card p-8 flex items-center gap-8 group bg-white border-brand-border">
                  <div className="text-3xl font-serif italic text-slate-100 group-hover:text-brand-primary transition-colors">
                    0{i+1}
                  </div>
                  <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-brand-primary group-hover:bg-brand-primary/5 transition-all">
                    <step.icon size={28} strokeWidth={1.5} />
                  </div>
                  <div className="flex-grow">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">{step.time}</p>
                    <p className="text-xl font-medium tracking-tight text-slate-700">{step.act}</p>
                  </div>
                </div>
              ))}
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
