import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, BookOpen, Clock, ClipboardCheck, Sparkles, Pencil, Zap, ShieldCheck, Brain, CheckCircle2, Loader2, X, AlertTriangle } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { UserProfile, CortexResponse, CortexInput } from '../types';
import { getCortexResponse, getEmergencyAction } from '../services/cortexService';
import { cn } from '../lib/utils';

export default function WorkMode() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [note, setNote] = useState('');
  const [cortex, setCortex] = useState<CortexResponse | null>(null);
  const [loadingCortex, setLoadingCortex] = useState(false);
  const [emergencyAction, setEmergencyAction] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snapshot) => {
      if (snapshot.exists()) setProfile(snapshot.data() as UserProfile);
    });
    return unsub;
  }, []);

  const triggerCortex = async () => {
    if (!auth.currentUser || loadingCortex || !note.trim()) return;
    setLoadingCortex(true);

    const input: CortexInput = {
      energia: profile?.energyLevel || 'medium',
      estado_emocional: profile?.crisisMode ? 'crise' : 'ok',
      tentativas_falha: 0,
      tempo_inativo_min: 0,
      tipo_evento: 'foco_executivo',
      tarefa: note
    };

    try {
      const response = await getCortexResponse(input);
      setCortex(response);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCortex(false);
    }
  };

  const triggerEmergency = async () => {
    if (!auth.currentUser || isEmergencyLoading || !note.trim()) return;
    setIsEmergencyLoading(true);
    try {
      const action = await getEmergencyAction(note, attempts);
      setEmergencyAction(action);
      setAttempts(prev => prev + 1);
    } catch (e) {
      console.error(e);
    } finally {
      setIsEmergencyLoading(false);
    }
  };

  const resetEmergency = () => {
    setEmergencyAction(null);
    setAttempts(0);
  };

  const teacherChecklists = [
    "Material da aula separado?",
    "Diário de classe atualizado?",
    "Objetivo da aula definido?",
    "Atividade prática pronta?"
  ];

  const motoboyChecklist = [
    { text: 'Capacete e Equipamento (Segurança em 1º)', icon: ShieldCheck },
    { text: 'Suporte fixo para o GPS (Foco total no trânsito)', icon: Zap },
    { text: 'Garrafa de água acoplada (Foco exige hidratação)', icon: Sparkles },
    { text: 'Bloqueio de notificações não-trabalho', icon: Clock },
    { text: 'Repouso consciente entre entregas (3 min)', icon: Pencil },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <header className="space-y-4">
        <h1 className="text-5xl font-light tracking-tight">Foco no <span className="font-bold whitespace-nowrap">Trabalho</span></h1>
        <div className="flex items-center justify-between border-b border-black/5 pb-6">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest leading-relaxed">
            Seu tempo é precioso. <br />Protocolos de Retorno e Foco.
          </p>
        </div>
      </header>

      {/* Digital Notebook & Prefrontal Cortex Assistant */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="bg-brand-primary p-2 rounded-xl text-white shadow-lg shadow-brand-primary/20">
            <Brain size={20} />
          </div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em]">Córtex Pré-frontal Digital</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <textarea
                placeholder="O que está na sua cabeça agora? (Ex: 'Preciso corrigir 40 provas mas estou exausto')"
                className="w-full h-48 bg-white border border-brand-border rounded-[2.5rem] p-8 text-xl tracking-tight outline-none focus:border-brand-primary transition-all shadow-sm resize-none"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="absolute right-8 bottom-8 flex gap-3">
                <button 
                  onClick={triggerEmergency}
                  disabled={isEmergencyLoading || !note.trim()}
                  className="bg-red-50 text-red-600 px-6 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all flex items-center gap-2"
                >
                  {isEmergencyLoading ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                  Travado
                </button>
                <button 
                  onClick={triggerCortex}
                  disabled={loadingCortex || !note.trim()}
                  className="bg-[#1A1A1A] text-white px-8 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-20 transition-all shadow-xl flex items-center gap-3"
                >
                  {loadingCortex ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                  Córtex Pré-frontal
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic px-4">
              * Use este botão quando não conseguir decidir o que fazer ou estiver paralisado por uma ideia.
            </p>
          </div>

          <div className="relative min-h-[12rem] space-y-4">
             {/* Emergency Action System */}
             {emergencyAction && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-red-600 text-white p-8 rounded-[2.5rem] shadow-2xl border-4 border-red-500 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-20">
                    <AlertTriangle size={48} />
                  </div>
                  <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-bold uppercase tracking-[0.4em] opacity-60">Sistema de Ação de Emergência</span>
                      <button onClick={resetEmergency} className="hover:rotate-90 transition-transform">
                        <X size={16} />
                      </button>
                    </div>
                    <h4 className="text-3xl font-bold tracking-tighter leading-none">
                      "{emergencyAction}"
                    </h4>
                    <div className="flex gap-2">
                       <button 
                         onClick={triggerEmergency}
                         className="flex-1 bg-white/20 hover:bg-white/30 py-3 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all"
                       >
                         Não consigo
                       </button>
                       <button 
                         onClick={resetEmergency}
                         className="flex-1 bg-white text-red-600 py-3 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all"
                       >
                         Vou fazer
                       </button>
                    </div>
                  </div>
                </motion.div>
              )}

            <AnimatePresence mode="wait">
              {cortex ? (
                <motion.div
                  key="cortex-output"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    "h-full p-8 rounded-[2.5rem] border-2 flex flex-col justify-between transition-all",
                    cortex.interface === 'reduzida' ? "bg-red-50 border-red-200" : "bg-brand-primary/5 border-brand-primary/20"
                  )}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <Zap size={20} className="text-brand-primary" />
                      <button onClick={() => setCortex(null)} className="text-slate-300 hover:text-slate-500">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="space-y-2">
                       {cortex.mensagens.map((msg, i) => (
                         <p key={i} className="text-lg font-medium text-slate-800 leading-tight tracking-tight">
                           {msg}
                         </p>
                       ))}
                    </div>
                  </div>
                  <div className="pt-4">
                    <div className="bg-brand-primary text-white px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest inline-block">
                      {cortex.acao}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="cortex-empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full border-2 border-dashed border-slate-100 rounded-[2.5rem] flex items-center justify-center p-8 text-center"
                >
                  <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">
                    Escreva ao lado e ative <br/>sua função executiva
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Hero: Return for Motoboy / Global Work Context */}
      <div className="adhd-card !bg-[#1A1A1A] text-white p-12 rounded-[3.5rem] relative overflow-hidden group">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-brand-primary">
              <Zap size={24} fill="currentColor" />
              <span className="font-bold uppercase tracking-[0.3em] text-[10px]">Protocolo de Retorno</span>
            </div>
            <h2 className="text-5xl font-light tracking-tight leading-none">De volta às <br/><span className="font-bold italic">Entregas</span></h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Você está se recuperando de um colapso. O foco agora não é o volume de entregas, mas a <strong>segurança</strong> e a <strong>regulação emocional</strong> no trânsito.
            </p>
            <div className="flex gap-4">
              <button className="px-8 py-5 bg-white text-black rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-brand-primary hover:text-white transition-all shadow-2xl active:scale-95 shadow-white/5">Ativar Modo Estrada</button>
            </div>
          </div>
          <div className="space-y-4 bg-white/5 p-8 rounded-[3rem] border border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Checklist de Segurança (Motoboy)</p>
            <div className="space-y-5">
              {motoboyChecklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-5 group cursor-pointer">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-white/40 group-hover:bg-brand-primary group-hover:text-white transition-all">
                    <item.icon size={18} />
                  </div>
                  <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Teacher Return Protocol (Systemic Recovery) */}
        <div className="adhd-card p-12 space-y-10 rounded-[3.5rem] border-brand-border bg-white shadow-xl shadow-slate-100">
          <header className="space-y-3 pb-8 border-b border-black/5">
            <div className="flex items-center gap-2 text-brand-primary">
              <GraduationCap size={20} />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Protocolo de Retorno: Professor</span>
            </div>
            <h2 className="text-5xl font-light tracking-tighter leading-none">Fortalecimento <br/><span className="font-bold">Psicológico</span></h2>
            <p className="text-slate-400 text-sm italic">Afastamento: 17/04 ─ 29/04. Use este tempo para blindar sua mente.</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Fase 1: Descompressão Total (Até 24/04)</h4>
              <div className="space-y-4">
                {[
                  "Silêncio sobre o trabalho (não abra e-mails ou grupos)",
                  "Sono sem despertador (Regulação de Cortisol)",
                  "Pequenas caminhadas sem celular (Dopamina natural)",
                  "Escrita Terapêutica: 'O que me fez colapsar?'"
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <span className="text-brand-primary font-bold">0{i+1}.</span>
                    <p className="text-lg font-medium text-slate-600 tracking-tight leading-snug">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-8">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Fase 2: Retorno Blindado (De 25/04 a 29/04)</h4>
              <div className="space-y-4">
                {[
                  "Planejar 1 aula 'Low Energy' (Atividade autônoma)",
                  "Definir Horário de Saída inegociável",
                  "Treinar o 'Não' educadamente para novas demandas",
                  "Preparar material físico (Evitar telas antes da aula)"
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <span className="text-brand-accent font-bold">0{i+1}.</span>
                    <p className="text-lg font-medium text-slate-600 tracking-tight leading-snug">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-zinc-50 p-8 rounded-[2.5rem] border border-brand-border flex flex-col md:flex-row gap-6 items-center">
            <div className="w-14 h-14 bg-[#1A1A1A] text-white rounded-2xl flex items-center justify-center shrink-0">
              <Brain size={24} />
            </div>
            <p className="text-xl font-medium text-slate-700 tracking-tight leading-relaxed">
              <strong>Prevenção de Inconstância:</strong> Comece com 60% da carga. Se tentar dar 100% no primeiro dia, o colapso volta em duas semanas.
            </p>
          </div>
        </div>

        {/* Daily Checklist (General Professional) */}
        <div className="adhd-card p-10 space-y-8 rounded-[3rem] border-brand-border">
          <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-30">Checklist Operacional</h3>
          <div className="space-y-6">
            {teacherChecklists.map((item, i) => (
              <div key={i} className="flex items-center gap-4 group cursor-pointer">
                <div className="w-8 h-8 border border-slate-200 rounded-xl group-hover:border-brand-primary transition-colors flex items-center justify-center bg-zinc-50" />
                <span className="text-lg font-medium text-slate-600 group-hover:text-black transition-colors tracking-tight leading-tight">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MODO PROFESSOR: Escola & Diários */}
        <div className="adhd-card p-10 space-y-8 rounded-[3rem] border-brand-border bg-[#F8F9FE]">
           <div className="flex items-center gap-3 text-blue-600">
             <BookOpen size={20} />
             <h3 className="text-[10px] font-bold uppercase tracking-widest">Modo Professor: Escola</h3>
           </div>
           
           <div className="space-y-4">
             <div className="p-5 bg-white rounded-2xl border border-blue-50 flex items-center justify-between">
               <span className="text-sm font-medium text-slate-700">Preencher Diário de Classe</span>
               <div className="text-[8px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded">PENDENTE</div>
             </div>
             <div className="p-5 bg-white rounded-2xl border border-blue-50 flex items-center justify-between">
               <span className="text-sm font-medium text-slate-700">Lançar Notas (Bimestre)</span>
               <div className="text-[8px] font-bold bg-zinc-50 text-zinc-300 px-2 py-1 rounded">AZUL</div>
             </div>
             <div className="p-5 bg-white rounded-2xl border border-blue-50 flex items-center justify-between opacity-50">
               <span className="text-sm font-medium text-slate-700 decoration-slate-300 line-through">Reunião de Pais</span>
               <CheckCircle2 size={16} className="text-green-500" />
             </div>
           </div>

           <p className="text-[10px] text-slate-400 italic">
             *Estas tarefas não expiram. Elas ficam aqui até você concluir, sem pressão de data.
           </p>
        </div>
      </div>

      {/* Survival Tip */}
      <section className="pt-12 border-t border-black/5">
        <div className="bg-zinc-50 border border-brand-border p-10 rounded-[3rem] flex flex-col sm:flex-row items-center gap-8 text-center sm:text-left">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-brand-primary shrink-0 shadow-sm">
            <Sparkles size={40} strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary opacity-40">Dica de Sobrevivência</p>
            <p className="text-2xl font-serif italic text-slate-400 leading-snug">
              "Seja gentil consigo mesmo. Se a aula não foi perfeita, amanhã é uma nova chance."
            </p>
          </div>
        </div>
      </section>
    </div>

  );
}
