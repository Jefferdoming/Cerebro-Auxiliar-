import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Send, User, Bot, Sparkles, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

// Model config
const MODEL_NAME = "gemini-3-flash-preview";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_INSTRUCTION = `
Você é o "Cérebro Auxiliar", um assistente terapêutico focado em adultos com TDAH.
Sua missão é dar instruções PRÁTICAS, DIRETAS e EMPÁTICAS.
Evite enrolação. Se o usuário estiver travado, dê um comando simples agora (ex: "Levante agora e beba água").

Contexto do usuário:
- Adulto com TDAH.
- Professor (precisa de checklists simples, não reinventar aula).
- Dívida de R$ 21k (precisa evitar gastos impulsivos).
- Dificuldade com memória, rotina e gestão emocional.

Tom:
- Empático mas direto.
- Respostas curtas (máximo 3 parágrafos).
- Use bullet points.
- Sempre sugira UMA pequena ação imediata ao final.
`;

export default function Chatbot() {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; content: string }[]>([
    { role: 'bot', content: 'Olá! Sou seu Cérebro Auxiliar. Está se sentindo travado ou precisa organizar algo agora?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        },
      });

      const botResponse = response.text || "Desculpe, tive um pequeno curto-circuito. Pode repetir?";
      setMessages(prev => [...prev, { role: 'bot', content: botResponse }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: "Erro de conexão. Vamos tentar de novo?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] max-w-4xl mx-auto">
      <header className="mb-10 space-y-2 border-b border-black/5 pb-8">
        <h1 className="text-4xl font-light tracking-tight">Chatbot <span className="font-bold">Terapêutico</span></h1>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">Associação Livre e Instrução Direta</p>
      </header>

      <div className="flex-1 overflow-y-auto space-y-8 pr-4 mb-4 scrollbar-hide scroll-smooth">
        {messages.map((msg, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={i}
            className={cn(
              "flex flex-col gap-2 max-w-[85%]",
              msg.role === 'user' ? "ml-auto items-end text-right" : "items-start text-left"
            )}
          >
            <div className={cn(
              "text-[10px] uppercase tracking-widest font-bold opacity-30 mb-1",
              msg.role === 'user' ? "text-slate-500" : "text-brand-primary"
            )}>
              {msg.role === 'user' ? 'Você' : 'Cérebro Auxiliar'}
            </div>
            <div className={cn(
              "p-6 rounded-2xl text-lg tracking-tight leading-relaxed",
              msg.role === 'user' 
                ? "bg-[#1A1A1A] text-white rounded-tr-none shadow-xl" 
                : "bg-white text-slate-700 shadow-sm border border-brand-border rounded-tl-none font-medium"
            )}>
              <div className="markdown-body">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex flex-col gap-2 max-w-[85%] items-start">
            <div className="text-[10px] uppercase tracking-widest font-bold opacity-30 animate-pulse">Pensando...</div>
            <div className="p-6 bg-white rounded-2xl rounded-tl-none border border-brand-border shadow-sm flex gap-2">
              <span className="w-2 h-2 bg-slate-200 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-slate-200 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 bg-slate-200 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="relative mt-8">
        <input
          type="text"
          placeholder="Como você está se sentindo agora?"
          className="w-full bg-white p-8 rounded-[2rem] shadow-2xl outline-none border border-brand-border focus:border-brand-primary pr-24 text-xl tracking-tight transition-all"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button 
          onClick={sendMessage}
          className="absolute right-4 top-4 w-16 h-16 bg-[#1A1A1A] text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <Send size={28} />
        </button>
      </div>

      <div className="mt-8 flex gap-3 overflow-x-auto pb-4 no-scrollbar">
        {['Estou travado', 'Dica de aula', 'Gasto impulsivo', 'Apenas respirar'].map((chip) => (
          <button 
            key={chip}
            onClick={() => setInput(chip)}
            className="whitespace-nowrap px-6 py-3 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest rounded-full border border-brand-border hover:border-brand-primary hover:text-brand-primary transition-all"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}
