import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { BookOpen, Sparkles, Brain, ArrowRight, Loader2, MessageSquare, ShieldAlert, History, Trash2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';
import { JournalEntry } from '../types';

const MODEL_NAME = "gemini-3-flash-preview";

export default function Journal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [content, setContent] = useState('');
  const [insight, setInsight] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  
  const [taskToGuide, setTaskToGuide] = useState('');
  const [guidance, setGuidance] = useState<JournalEntry['actionGuidance'] | null>(null);
  const [loadingGuidance, setLoadingGuidance] = useState(false);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'journal_entries'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as JournalEntry[]);
    });

    return () => unsub();
  }, []);

  const deleteEntry = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja apagar este registro?')) return;
    try {
      await deleteDoc(doc(db, 'journal_entries', id));
    } catch (error) {
      console.error("Erro ao deletar registro:", error);
    }
  };

  const getInsights = async () => {
    if (!content.trim()) return;
    setLoadingAI(true);
    try {
      const prompt = `Você é um neuropsicólogo empático especializado em TDAH. 
      O usuário escreveu no seu diário sobre seus anseios e medos:
      "${content}"
      
      Forneça 2 ou 3 insights valiosos e práticos que ajudem o usuário a processar essas emoções sem sobrecarga. 
      Use um tom acolhedor, profissional e direto (estilo Cérebro Auxiliar). 
      Foque na validação emocional e em estratégias cognitivas.`;

      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ text: prompt }]
      });

      const responseText = result.text || "Não foi possível gerar insights agora. Respire fundo.";
      setInsight(responseText);

      // Save to Firestore
      if (auth.currentUser) {
        await addDoc(collection(db, 'journal_entries'), {
          userId: auth.currentUser.uid,
          content,
          insight: responseText,
          date: new Date().toISOString().split('T')[0],
          createdAt: serverTimestamp()
        });
        setContent('');
      }
    } catch (error) {
      console.error(error);
      setInsight("Erro ao conectar com o Cérebro Auxiliar.");
    } finally {
      setLoadingAI(false);
    }
  };

  const getGuidance = async () => {
    if (!taskToGuide.trim()) return;
    setLoadingGuidance(true);
    try {
      const prompt = `O usuário com TDAH precisa realizar a seguinte tarefa: "${taskToGuide}".
      
      1. Forneça uma descrição detalhada mas simplificada da tarefa (quebrando a paralisia por análise).
      2. Ofereça DUAS OPÇÕES claras e distintas de como prosseguir (Opção A e Opção B).
      
      Retorne apenas um JSON no formato:
      {
        "task": "${taskToGuide}",
        "description": "descrição simplificada",
        "options": [
          {"label": "Opção A", "description": "descrição da opção"},
          {"label": "Opção B", "description": "descrição da opção"}
        ]
      }`;

      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ text: prompt }],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(result.text || '{}');
      setGuidance(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingGuidance(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <header className="space-y-4">
        <h1 className="text-5xl font-light tracking-tight">Diário de <span className="font-bold whitespace-nowrap">Consciência</span></h1>
        <div className="flex items-center justify-between border-b border-black/5 pb-8 mb-4">
          <p className="text-sm font-medium text-slate-600 uppercase tracking-widest leading-relaxed">
            Processe emoções & Tome decisões. <br />A clareza é o antídoto para a ansiedade.
          </p>
        </div>
      </header>

      {/* Journal Entry Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="adhd-card bg-white p-10 space-y-6 shadow-xl border-brand-border">
          <div className="flex items-center gap-3 text-brand-primary">
            <BookOpen size={24} />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em]">Descarga Mental</h2>
          </div>
          <p className="text-sm text-slate-700">Escreva sobre seus anseios, medos ou receios de hoje.</p>
          <textarea
            rows={6}
            placeholder="O que está ocupando espaço na sua mente agora?"
            className="w-full bg-zinc-50 border border-brand-border p-6 rounded-3xl outline-none focus:border-brand-primary transition-all text-lg tracking-tight resize-none"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button
            onClick={getInsights}
            disabled={loadingAI || !content.trim()}
            className="w-full py-6 bg-brand-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
          >
            {loadingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Obter Insights
          </button>
        </div>

        <div className="adhd-card bg-[#1A1A1A] text-white p-10 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3 text-brand-warning">
            <Brain size={24} />
            <h2 className="text-[10px] font-bold uppercase tracking-[0.4em]">Laboratório de Ação</h2>
          </div>
          <p className="text-sm text-white/80">Precisa fazer algo mas não sabe como começar? Deixe a IA detalhar e te dar 2 caminhos.</p>
          <input
            type="text"
            placeholder="Qual tarefa te trava?"
            className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl outline-none focus:border-brand-primary text-lg tracking-tight"
            value={taskToGuide}
            onChange={(e) => setTaskToGuide(e.target.value)}
          />
          <button
            onClick={getGuidance}
            disabled={loadingGuidance || !taskToGuide.trim()}
            className="w-full py-6 border-2 border-brand-warning text-brand-warning rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
          >
            {loadingGuidance ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            Guia de Ação
          </button>
        </div>
      </section>

      {/* AI Results Section */}
      <AnimatePresence mode="wait">
        {(insight || guidance) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {insight && (
              <div className="bg-white border-2 border-brand-primary/10 rounded-[3rem] p-12 shadow-xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 text-brand-primary pointer-events-none">
                  <Sparkles size={120} />
                </div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-primary">Insights do Cérebro Auxiliar</h3>
                <div className="prose prose-slate max-w-none">
                  <ReactMarkdown>{insight}</ReactMarkdown>
                </div>
                <button 
                  onClick={() => setInsight(null)}
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-all"
                >
                  Fechar Insights
                </button>
              </div>
            )}

            {guidance && (
              <div className="bg-[#1A1A1A] text-white rounded-[3rem] p-12 shadow-2xl space-y-8 relative overflow-hidden border border-brand-warning/20">
                <div className="absolute top-0 right-0 p-8 opacity-5 text-brand-warning pointer-events-none">
                  <Brain size={120} />
                </div>
                <header className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-warning">Caminhos de Ação</h3>
                  <h4 className="text-4xl font-light tracking-tight italic">"{guidance.task}"</h4>
                  <p className="text-slate-200 text-lg">{guidance.description}</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {guidance.options.map((opt, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 p-8 rounded-[2rem] space-y-4 hover:border-brand-warning transition-all group">
                      <div className="w-10 h-10 bg-brand-warning text-black rounded-full flex items-center justify-center font-bold">
                        {i === 0 ? 'A' : 'B'}
                      </div>
                      <h5 className="text-xl font-bold">{opt.label}</h5>
                      <p className="text-slate-300 text-sm leading-relaxed">{opt.description}</p>
                    </div>
                  ))}
                </div>
                
                <button 
                  onClick={() => setGuidance(null)}
                  className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white/40 transition-all"
                >
                  Limpar Guia
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 opacity-70">
          <History size={18} />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em]">Registros Anteriores</h3>
        </div>
        
        <div className="space-y-4">
          {entries.length > 0 ? entries.map((entry) => (
            <div key={entry.id} className="bg-white border border-slate-100 p-8 rounded-3xl space-y-4 shadow-sm group hover:border-brand-primary transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 italic">{entry.date}</span>
                  <button 
                    onClick={() => deleteEntry(entry.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors"
                    title="Excluir registro"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <MessageSquare size={16} className="text-slate-100" />
              </div>
              <p className="text-lg text-slate-700 tracking-tight leading-snug">
                {entry.content}
              </p>
              {entry.insight && (
                <div className="pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={12} className="text-brand-primary" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-brand-primary">Insight Salvo</span>
                  </div>
                  <div className="text-sm text-slate-500 prose prose-sm max-w-none">
                    <ReactMarkdown>{entry.insight}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )) : (
            <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem] opacity-30">
               <BookOpen size={48} className="mx-auto mb-4" />
               <p className="text-lg italic font-light">Seu histórico de consciência aparecerá aqui.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
