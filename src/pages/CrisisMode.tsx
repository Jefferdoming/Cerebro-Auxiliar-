import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Wind, CornerUpLeft, Volume2, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

export default function CrisisMode() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const steps = [
    { title: "Respire fundo", text: "Inspire pelo nariz por 4 segundos...", color: "bg-white" },
    { title: "Segure", text: "Mantenha o ar por 4 segundos...", color: "bg-[#FAFAFA]" },
    { title: "Solte devagar", text: "Solte pela boca por 4 segundos...", color: "bg-white" },
    { title: "Sinta seus pés", text: "Pressione seus pés contra o chão agora.", color: "bg-[#FAFAFA]" },
    { title: "Beba água", text: "Vá até a cozinha. Beba um copo de água.", color: "bg-white" }
  ];

  useEffect(() => {
    if (step < 3) {
      const timer = setTimeout(() => setStep(step + 1), 6000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex flex-col items-center justify-center p-8 transition-colors duration-[2000ms] ease-in-out",
      steps[step % steps.length].color
    )}>
      <motion.button
        whileHover={{ opacity: 0.6 }}
        onClick={() => navigate('/')}
        className="absolute top-12 left-12 text-[10px] font-bold uppercase tracking-[0.3em] opacity-30 flex items-center gap-2"
      >
        <CornerUpLeft size={16} /> Sair do Modo Crise
      </motion.button>

      <div className="absolute top-12 right-12 opacity-5">
        <ShieldAlert size={40} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
          className="text-center space-y-12"
        >
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="w-48 h-48 border border-black/10 rounded-full flex items-center justify-center mx-auto"
          >
            <Wind size={64} strokeWidth={1} className="text-slate-400" />
          </motion.div>
          
          <div className="space-y-4">
            <h1 className="text-5xl font-light tracking-tight text-slate-800">
              {steps[step % steps.length].title}
            </h1>
            <p className="text-xl text-slate-400 font-light max-w-sm mx-auto leading-relaxed">
              {steps[step % steps.length].text}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-24 flex gap-4">
        {steps.map((_, i) => (
          <div 
            key={i} 
            className={`w-1.5 h-1.5 rounded-full transition-all duration-1000 ${i === step % steps.length ? 'bg-black w-8 opacity-100' : 'bg-black opacity-10'}`}
          />
        ))}
      </div>

      <button 
        onClick={() => setStep((step + 1) % steps.length)}
        className="absolute bottom-40 text-[10px] font-bold uppercase tracking-[0.4em] opacity-40 hover:opacity-100 transition-opacity"
      >
        Seguir Próximo Passo
      </button>
    </div>
  );
}
