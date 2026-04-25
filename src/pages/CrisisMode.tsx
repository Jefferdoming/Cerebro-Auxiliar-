import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../lib/firebase';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Wind, CornerUpLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Task } from '../types';

export default function CrisisMode() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [priorityTask, setPriorityTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', auth.currentUser.uid),
      where('completed', '==', false),
      limit(1)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) setPriorityTask({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Task);
    });
    return unsub;
  }, []);

  const steps = [
    { title: "Respire fundo", text: "Inspire pelo nariz... expire pela boca.", color: "bg-white" },
    { title: "Sinta o chão", text: "Pressione seus pés contra o chão com força.", color: "bg-[#FAFAFA]" },
    { title: "Quase lá", text: "Tudo bem não conseguir tudo hoje.", color: "bg-white" },
    { title: "Só isso agora:", text: priorityTask?.content || "Beber um copo de água", color: "bg-brand-primary text-white", isFinal: true }
  ];

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 transition-colors duration-[1000ms]",
      steps[step].color
    )}>
      <motion.button
        onClick={() => navigate('/')}
        className="absolute top-12 left-12 text-[10px] font-bold uppercase tracking-[0.3em] opacity-30 flex items-center gap-2"
      >
        <CornerUpLeft size={16} /> Voltar
      </motion.button>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          className="text-center space-y-12 w-full max-w-lg"
        >
          <div className="space-y-4">
            <h1 className={cn(
              "text-5xl font-light tracking-tight leading-tight",
              steps[step].isFinal ? "text-white" : "text-slate-800"
            )}>
              {steps[step].title}
            </h1>
            <p className={cn(
              "text-xl font-light leading-relaxed",
              steps[step].isFinal ? "text-white/80" : "text-slate-400"
            )}>
              {steps[step].text}
            </p>
          </div>

          {steps[step].isFinal ? (
            <button 
              onClick={() => navigate('/')}
              className="w-full bg-white text-brand-primary py-8 rounded-[2rem] font-bold uppercase tracking-widest shadow-2xl flex items-center justify-center gap-4"
            >
              Vou tentar <CheckCircle2 size={24} />
            </button>
          ) : (
            <button 
              onClick={() => setStep(step + 1)}
              className="px-10 py-4 border border-black/10 rounded-full text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100"
            >
              Seguir
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-24 flex gap-4">
        {steps.map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full ${i === step ? 'bg-current scale-125' : 'bg-current opacity-10'}`} />
        ))}
      </div>
    </div>
  );
}
