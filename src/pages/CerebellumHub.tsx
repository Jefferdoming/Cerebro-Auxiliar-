import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Sparkles, Zap, BookOpen, Star, GraduationCap, 
  MessageCircle, Settings, Brain, Shield, 
  Heart, Target, Coffee, History, Bike, BrainCircuit
} from 'lucide-react';
import { cn } from '../lib/utils';

const tools = [
  {
    category: "Sistemas de Manutenção",
    items: [
      { id: 'routine', label: 'Ritual Matinal', icon: Sparkles, desc: 'Frequência cerebral do dia', color: 'text-yellow-500', path: '/routine' },
      { id: 'habits', label: 'Laboratório de Hábitos', icon: Zap, desc: 'Neuroplasticidade na prática', color: 'text-brand-primary', path: '/habits' },
      { id: 'journal', label: 'Jornal de Dopamina', icon: BookOpen, desc: 'Onde seus pensamentos param', color: 'text-blue-500', path: '/journal' },
      { id: 'remember', label: 'Não Esquecer', icon: BrainCircuit, desc: 'O seu Brain Dump externo', color: 'text-emerald-600', path: '/remember' },
    ]
  },
  {
    category: "Expansão & Trabalho",
    items: [
      { id: 'work', label: 'Foco Profundo', icon: GraduationCap, desc: 'Modo trabalho bloqueado', color: 'text-purple-500', path: '/work' },
      { id: 'trail', label: 'Trilha de Autoconhecimento', icon: Star, desc: 'Pílulas diárias de clareza', color: 'text-orange-500', path: '/trail' },
      { id: 'motoboy', label: 'Central Motoboy', icon: Bike, desc: 'Apache 200 & Ganhos', color: 'text-[#8b5cf6]', path: '/motoboy' },
    ]
  },
  {
    category: "Controle de Danos",
    items: [
      { id: 'crisis', label: 'Modo Crise (SOS)', icon: Shield, desc: 'Paralisia total ou pânico', color: 'text-red-500', path: '/crisis' },
      { id: 'finances', label: 'Radar Financeiro', icon: History, desc: 'Dívida e Sobrevivência', color: 'text-zinc-400', path: '/finances' },
      { id: 'chat', label: 'Chat Terapêutico', icon: MessageCircle, desc: 'Fale com seu Cérebro Auxiliar', color: 'text-emerald-500', path: '/chat' },
    ]
  }
];

export default function CerebellumHub() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-brand-primary">
          <Brain size={24} />
          <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Mapeamento Cognitivo</span>
        </div>
        <h1 className="text-5xl font-light tracking-tight">O seu <span className="font-bold whitespace-nowrap">Cerebelo Auxiliar</span></h1>
        <p className="text-slate-600 max-w-lg leading-relaxed">
          Onde suas funções automáticas e suporte de longo prazo residem. Use para ajustar sua rotina ou buscar ajuda específica.
        </p>
        <div className="bg-brand-primary/5 border border-brand-primary/10 p-4 rounded-2xl flex items-start gap-4">
          <div className="mt-1">
            <Zap size={14} className="text-brand-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Neuroscience Insight</p>
            <p className="text-xs text-slate-600 leading-relaxed">
              O Cerebelo e o Córtex Pré-Frontal trabalham em conjunto. O TDAH causa uma falha nessa coordenação. Estas ferramentas servem como um <strong>suporte externo</strong> para reduzir a carga cognitiva do seu cérebro real.
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-16">
        {tools.map((section, idx) => (
          <section key={idx} className="space-y-6">
            <h3 className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-90 ml-2">{section.category}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className="group bg-white p-8 rounded-[2.5rem] border border-brand-border text-left hover:shadow-2xl hover:shadow-zinc-200/50 transition-all hover:-translate-y-1 flex flex-col justify-between min-h-[220px]"
                >
                  <div className={cn("p-4 rounded-3xl bg-zinc-50 w-fit group-hover:scale-110 transition-transform", item.color)}>
                    <item.icon size={24} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold tracking-tight text-slate-800">{item.label}</h4>
                    <p className="text-xs text-slate-600 leading-snug">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="pt-12 border-t border-black/5">
        <div className="bg-[#1A1A1A] p-10 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 text-center md:text-left">
            <h4 className="text-2xl font-light tracking-tight">Precisa de <span className="font-bold">configurações?</span></h4>
            <p className="text-white/90 text-xs uppercase tracking-widest">Ajuste os parâmetros do seu sistema</p>
          </div>
          <button 
            onClick={() => navigate('/settings')}
            className="px-10 py-4 bg-white text-black rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all"
          >
            Acessar Ajustes
          </button>
        </div>
      </footer>
    </div>
  );
}
