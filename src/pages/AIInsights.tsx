import { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion } from 'motion/react';
import { BookOpen, Sparkles, Star, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

const MODEL_NAME = "gemini-3-flash-preview";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function AIInsights() {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInsight = async (topic?: string) => {
    setLoading(true);
    try {
      const prompt = `Gere um pequeno texto de autoconhecimento (Trilha TDAH) para hoje. 
      Foco: ${topic || 'Disciplina leve e organização sem culpa'}. 
      Formato: Markdown. Linguagem simples. Curto (máximo 150 palavras). 
      Inclua uma "Missão do Dia" prática.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt
      });
      setInsight(response.text || "Ops, tente novamente.");
    } catch (err) {
      setInsight("Certifique-se de configurar sua chave Gemini.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsight();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="space-y-4">
        <h1 className="text-5xl font-light tracking-tight">Trilha de <span className="font-bold whitespace-nowrap">Autoconhecimento</span></h1>
        <div className="flex items-center justify-between border-b border-black/5 pb-8 mb-4">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest leading-relaxed">
            Pílulas diárias de clareza mental. <br />Conheça seu cérebro.
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <article className="lg:col-span-8 space-y-10">
          <div className="adhd-card !p-12 space-y-8 bg-white rounded-[3rem] border-none shadow-xl shadow-slate-100">
            <header className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-primary opacity-40">Tópico de Hoje</div>
              <h2 className="text-4xl font-light tracking-tight text-slate-800">
                Lidando com a <span className="font-bold underline decoration-brand-warning decoration-8 underline-offset-4">Procrastinação</span>
              </h2>
            </header>
            
            <div className="editorial-line" />

            <div className="prose prose-slate max-w-none prose-p:text-xl prose-p:leading-relaxed prose-p:tracking-tight prose-p:text-slate-600 prose-strong:text-brand-primary prose-strong:font-bold prose-headings:font-light prose-headings:tracking-tight">
              {loading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-full" />
                  <div className="h-4 bg-slate-100 rounded w-5/6" />
                  <div className="h-4 bg-slate-100 rounded w-4/6" />
                </div>
              ) : (
                <ReactMarkdown>{insight || ''}</ReactMarkdown>
              )}
            </div>

            <div className="flex gap-6">
              <button 
                onClick={() => fetchInsight()}
                disabled={loading}
                className="group flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-[#1A1A1A] hover:gap-5 transition-all outline-none"
              >
                Gerar Novo Insight <ChevronRight className="group-hover:translate-x-2 transition-transform" />
              </button>
              {insight && (
                <button 
                  onClick={() => setInsight(null)}
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-red-400 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </article>

        <aside className="lg:col-span-4 space-y-8 flex flex-col">
          <div className="bg-[#1A1A1A] text-white p-10 rounded-[3rem] space-y-6">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Sparkles size={24} className="text-white" />
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Missão do Dia</p>
              <p className="text-xl font-medium tracking-tight leading-snug">
                Escreva <strong>uma única</strong> tarefa no papel e esconda o celular por 15 minutos.
              </p>
            </div>
          </div>

          <div className="adhd-card p-10 space-y-4 rounded-[3rem] flex-grow">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-30">Explorar Tópicos</p>
            <div className="space-y-4">
              {[
                "Higiene por dopamina",
                "Técnica Pomodoro",
                "O custo da troca",
                "Cansaço Decisório"
              ].map(tag => (
                <button 
                  key={tag} 
                  disabled={loading}
                  onClick={() => fetchInsight(tag)}
                  className="w-full flex items-center justify-between group cursor-pointer border-b border-black/5 pb-2 text-left"
                >
                  <span className={cn(
                    "text-sm font-bold group-hover:text-brand-primary transition-colors uppercase tracking-widest leading-none",
                    loading ? "text-slate-200" : "text-slate-400"
                  )}>{tag}</span>
                  <ChevronRight size={14} className="text-slate-200 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>

  );
}
