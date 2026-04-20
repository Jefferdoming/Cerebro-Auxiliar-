import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import { db, auth } from '../lib/firebase';
import { collection, query, where, limit, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, ArrowRight, Sparkles, Brain, Coffee, Zap, Wallet, GraduationCap, ShieldCheck, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Task, UserProfile } from '../types';

const MODEL_NAME = "gemini-3-flash-preview";
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', auth.currentUser.uid),
      where('completed', '==', false),
      limit(3)
    );

    const unsubTasks = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });

    const unsubProfile = onSnapshot(doc(db, 'users', auth.currentUser.uid), (doc) => {
      setProfile(doc.data() as UserProfile);
    });

    return () => {
      unsubTasks();
      unsubProfile();
    };
  }, []);

  const phrases = [
    "Você não é preguiçoso. Seu cérebro só funciona diferente.",
    "Faça pouco, mas faça agora.",
    "Disciplina não, direção.",
    "Um passo pequeno ainda é progresso.",
    "Sua mente é um navegador com 100 abas abertas, vamos fechar uma?",
    "Não mire na perfeição, mire na conclusão."
  ];

  const dailyPhrase = phrases[Math.floor(Math.random() * phrases.length)];

  const handleWhatNow = async () => {
    setLoadingSuggestion(true);
    try {
      const prompt = `Usuário (TDAH, Professor e Motoboy) está em fase de recuperação (afastado de 17/04 a 29/04).
      Ele se sente perdido e não sabe por onde começar.
      Tarefas pendentes hoje: ${tasks.map(t => t.content).join(', ') || 'Nenhuma tarefa específica registrada.'}
      
      Dê UMA única sugestão de micro-ação (máximo 15 palavras) que ajude a reduzir a paralisia de decisão. 
      Foque em autocuidado, organização física mínima ou regulação emocional.
      Seja direto, empático e use um tom "Cérebro Auxiliar".`;

      const result = await genAI.models.generateContent({
        model: MODEL_NAME,
        contents: prompt
      });
      setSuggestion(result.text || "Respire fundo por 1 minuto.");
    } catch (error) {
      setSuggestion("Beba um copo de água gelada agora.");
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const toggleTask = async (task: Task) => {
    await updateDoc(doc(db, 'tasks', task.id), {
      completed: !task.completed
    });
  };

  return (
    <div className="grid grid-cols-12 gap-10">
      {/* Main Column */}
      <section className="col-span-12 lg:col-span-7 space-y-12">
        <header className="space-y-2">
          <h1 className="text-5xl font-light tracking-tight leading-tight">
            Olá, <span className="font-semibold">{profile?.name || 'Neurodivergente'}</span>. <br />
            <span className="opacity-30">Respira.</span>
          </h1>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Status: Em Dia</span>
          </div>
        </header>

        {/* Professional Status / Recovery Tracker */}
        <div className="adhd-card !bg-[#1A1A1A] text-white !p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group">
          <Zap className="absolute -right-10 -top-10 w-48 h-48 opacity-5 rotate-12" />
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-brand-primary">
                <Brain size={18} />
                <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Cuidado Científico</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-4xl font-light tracking-tight leading-tight">Fase de <span className="font-bold italic">Recuperação</span></h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                  Retorno Gradual: 17/04 ─ 29/04. <br/>
                  <strong>Foco:</strong> Fortalecer o psicológico para evitar a inconstância no magistério e nas entregas.
                </p>
              </div>
              <Link to="/work" className="inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white border-b border-white/20 pb-1 hover:border-brand-primary transition-all">
                Ver Protocolos de Retorno <ArrowRight size={14} />
              </Link>
            </div>
            <div className="bg-white/5 p-6 rounded-[2.5rem] space-y-4 border border-white/5">
              <div className="flex justify-between items-end">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Recuperação: Dia 03</p>
                <p className="text-xs font-mono opacity-40 uppercase">Afastado</p>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: "30%" }} className="h-full bg-brand-primary shadow-[0_0_15px_rgba(var(--brand-primary),0.5)]" />
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest text-center">Fase 1: Descompressão Total</p>
            </div>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="space-y-6">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-bold opacity-30">Foco do Dia (Máx 3)</h3>
          <div className="space-y-3">
            {tasks.length > 0 ? tasks.map((task) => (
              <motion.div
                layout
                key={task.id}
                onClick={() => toggleTask(task)}
                className="task-card p-6 bg-white rounded-xl flex justify-between items-center cursor-pointer shadow-sm group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-5 h-5 border-2 border-slate-200 rounded transition-colors group-hover:border-brand-primary" />
                  <span className="text-xl font-medium tracking-tight text-slate-700">{task.content}</span>
                </div>
                <span className="text-[10px] font-mono opacity-20 uppercase tracking-widest hidden sm:inline">Pendente</span>
              </motion.div>
            )) : (
              <div className="task-card !p-12 text-center opacity-30 border-dashed">
                <Coffee className="mx-auto mb-2" size={32} />
                <p className="italic text-sm">Tudo concluído por agora.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quote */}
        <div className="pt-8 border-t border-black/5">
          <p className="text-3xl italic font-serif text-slate-400 leading-snug">
            "{dailyPhrase}"
          </p>
        </div>
      </section>

      {/* Sidebar Column */}
      <aside className="col-span-12 lg:col-span-5 flex flex-col gap-8">
        <button 
          onClick={handleWhatNow}
          className="brain-button !py-12 !px-8 text-left relative overflow-hidden group rounded-[2rem]"
        >
          <div className="relative z-10 text-[10px] uppercase tracking-[0.3em] opacity-50 mb-4">Cérebro Auxiliar</div>
          <div className="relative z-10 text-3xl font-light leading-tight mb-2">O que eu <br /><span className="font-bold">faço agora?</span></div>
          <div className="relative z-10 text-xs opacity-40 font-medium">
            {loadingSuggestion ? "Consultando IA..." : "Toque para uma micro-ação personalizada"}
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-5 transform rotate-12 group-hover:scale-110 transition-transform">
            {loadingSuggestion ? <Loader2 className="animate-spin" size={180} /> : <Brain size={180} />}
          </div>
        </button>

        {suggestion && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 bg-zinc-50 border border-brand-border rounded-3xl text-center shadow-inner"
          >
            <Zap className="text-brand-primary mx-auto mb-3" />
            <p className="text-2xl font-light text-slate-800 tracking-tight leading-snug">{suggestion}</p>
          </motion.div>
        )}

        {/* Quick Finance Peek */}
        <div className="adhd-border rounded-3xl p-8 bg-white border border-brand-border space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30">Financeiro</h3>
            <span className="text-[10px] bg-red-50 text-red-600 px-3 py-1 rounded-full font-bold uppercase tracking-tighter">Foco real</span>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Dívida Atual</p>
            <p className="text-4xl font-light tracking-tighter text-slate-800">R$ 21.529,00</p>
          </div>
          <div className="editorial-line" />
          <p className="text-[10px] leading-relaxed text-slate-400 uppercase tracking-widest font-bold">
            Meta: Não abrir apps de compra hoje.
          </p>
        </div>
      </aside>
    </div>
  );
}
