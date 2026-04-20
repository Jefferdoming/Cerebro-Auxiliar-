import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, Home, ListTodo, Wallet, GraduationCap, MessageCircle, Settings, LogOut, Star, Zap, ArrowRight, Sparkles, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from './lib/utils';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import CrisisMode from './pages/CrisisMode';
import Finances from './pages/Finances';
import Tasks from './pages/Tasks';
import WorkMode from './pages/WorkMode';
import Chatbot from './pages/Chatbot';
import AIInsights from './pages/AIInsights';
import Habits from './pages/Habits';
import Routine from './pages/Routine';
import Calendar from './pages/Calendar';

function AppLayout({ children, user }: { children: React.ReactNode, user: User | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isCrisisPage = location.pathname === '/crisis';

  if (!user && location.pathname !== '/login') return <Navigate to="/login" />;
  if (user && location.pathname === '/login') return <Navigate to="/" />;

  const navItems = [
    { path: '/', label: 'Início', icon: Home },
    { path: '/tasks', label: 'Rotina', icon: ListTodo },
    { path: '/calendar', label: 'Agenda', icon: CalendarIcon },
    { path: '/routine', label: 'Ritual', icon: Sparkles },
    { path: '/habits', label: 'Hábitos', icon: Zap },
    { path: '/finances', label: 'Finanças', icon: Wallet },
  ];

  const secondaryItems = [
    { path: '/trail', label: 'Trilha', icon: Star },
    { path: '/work', label: 'Trabalho', icon: GraduationCap },
    { path: '/chat', label: 'Chatbot', icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FCFCFB] text-[#1A1A1A]">
      {/* Sidebar Navigation - Desktop only */}
      {!isCrisisPage && user && (
        <aside className="hidden md:flex w-72 bg-[#1A1A1A] text-white flex-col p-8 fixed h-full z-40">
          <div className="mb-12">
            <h1 className="text-2xl font-light tracking-tight leading-tight">
              Cérebro <br/><span className="font-bold">Auxiliar</span>
            </h1>
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-30 mt-2">
              v1.0.4 • SISTEMA DE SUPORTE
            </p>
          </div>

          <nav className="flex-grow space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-20 mb-4 ml-2">Foco Diário</p>
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group",
                  location.pathname === item.path 
                    ? "bg-white text-black shadow-xl" 
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon size={20} />
                <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
              </button>
            ))}

            <div className="pt-8 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-20 mb-4 ml-2">Ferramentas</p>
              {secondaryItems.map((item) => (
                <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group",
                  location.pathname === item.path 
                    ? "bg-white/10 text-white" 
                    : "text-white/40 hover:text-white"
                )}
              >
                <item.icon size={18} />
                <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
              </button>
              ))}
            </div>
          </nav>

          <footer className="pt-8 border-t border-white/5">
            <button 
              onClick={() => auth.signOut()}
              className="flex items-center gap-4 px-4 py-3 w-full text-white/30 hover:text-brand-accent transition-colors"
            >
              <LogOut size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Sair</span>
            </button>
          </footer>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={cn(
        "flex-grow flex flex-col min-h-screen",
        user && !isCrisisPage && "md:ml-72"
      )}>
        {/* Mobile Header */}
        {!isCrisisPage && user && (
          <header className="md:hidden w-full px-6 pt-10 flex justify-between items-end border-b border-black/5 pb-8 mb-8">
             <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="text-3xl font-light tracking-tight">
                Cérebro <span className="font-bold">Auxiliar</span>
              </h1>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="p-3 bg-zinc-50 rounded-xl text-slate-400"
            >
              <LogOut size={18} />
            </button>
          </header>
        )}

        {/* Desktop Greeting Header (Conditional) */}
        {!isCrisisPage && user && (
          <header className="hidden md:flex max-w-5xl w-full px-12 pt-12 justify-between items-center mb-8">
             <p className="text-[10px] uppercase tracking-[0.4em] font-bold opacity-30">
               {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
             </p>
             <div className="flex gap-4">
               <button onClick={() => navigate('/crisis')} title="Botão de Pânico" className="w-10 h-10 rounded-full border border-red-100 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                  <AlertCircle size={20} />
               </button>
             </div>
          </header>
        )}

        <main className={cn(
          "flex-grow mx-auto w-full px-6 md:px-12 pb-32 md:pb-12 max-w-5xl",
          isCrisisPage && "p-0 max-w-none ml-0"
        )}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Simplified Mobile Bottom Navigation - Dark UX */}
      {!isCrisisPage && user && (
        <nav className="md:hidden fixed bottom-6 left-6 right-6 z-50">
          <div className="bg-[#1A1A1A] text-white rounded-[2rem] p-2 flex justify-between items-center shadow-2xl border border-white/5 backdrop-blur-md bg-opacity-95">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all",
                  location.pathname === item.path 
                    ? "bg-white text-black shadow-lg" 
                    : "text-white/40 hover:text-white/60"
                )}
              >
                <item.icon size={20} />
                <span className="text-[9px] font-bold uppercase tracking-widest">{item.label}</span>
              </button>
            ))}
            {/* More Menu Toggle for Mobile */}
            <button 
              onClick={() => navigate('/chat')}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl text-white/40",
                ['/trail', '/work', '/chat'].includes(location.pathname) && "bg-white text-black shadow-lg"
              )}
            >
              <Settings size={20} />
              <span className="text-[9px] font-bold uppercase tracking-widest">Mais</span>
            </button>
          </div>
        </nav>
      )}

      {/* Floating SOS (Hidden on Desktop if integrated elsewhere, but keep for easy reach on mobile) */}
      {!isCrisisPage && user && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => navigate('/crisis')}
          className="md:hidden fixed bottom-28 right-8 w-14 h-14 bg-brand-accent text-white rounded-full shadow-2xl flex items-center justify-center z-50 pulse"
        >
          <AlertCircle size={28} />
        </motion.button>
      )}
    </div>
  );
}


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-brand-bg">
      <motion.div 
        animate={{ scale: [1, 1.2, 1] }} 
        transition={{ repeat: Infinity, duration: 2 }}
        className="text-brand-primary font-bold text-2xl"
      >
        Cérebro Auxiliar...
      </motion.div>
    </div>
  );

  return (
    <BrowserRouter>
      <AppLayout user={user}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Dashboard />} />
          <Route path="/crisis" element={<CrisisMode />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/routine" element={<Routine />} />
          <Route path="/habits" element={<Habits />} />
          <Route path="/work" element={<WorkMode />} />
          <Route path="/trail" element={<AIInsights />} />
          <Route path="/chat" element={<Chatbot />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

