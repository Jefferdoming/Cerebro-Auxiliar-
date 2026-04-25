import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, 
  deleteDoc, doc, serverTimestamp, orderBy, updateDoc 
} from 'firebase/firestore';
import { 
  BrainCircuit, Plus, Trash2, CheckCircle2, 
  Clock, AlertCircle, Sparkles, Pin, PinOff 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Remembrance {
  id: string;
  userId: string;
  text: string;
  priority: 'low' | 'medium' | 'high';
  isPinned: boolean;
  createdAt: any;
}

export default function Remember() {
  const [items, setItems] = useState<Remembrance[]>([]);
  const [newItem, setNewItem] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'remembrances'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('isPinned', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Remembrance[]);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim() || !auth.currentUser) return;

    await addDoc(collection(db, 'remembrances'), {
      userId: auth.currentUser.uid,
      text: newItem.trim(),
      priority,
      isPinned: false,
      createdAt: serverTimestamp()
    });

    setNewItem('');
    setPriority('medium');
  };

  const deleteItem = async (id: string) => {
    await deleteDoc(doc(db, 'remembrances', id));
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    const docRef = doc(db, 'remembrances', id);
    await updateDoc(docRef, { isPinned: !currentPinned });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-brand-primary">
          <BrainCircuit size={32} className="animate-pulse" />
          <h1 className="text-5xl font-light tracking-tighter">Não <span className="font-bold">Esquecer</span></h1>
        </div>
        <p className="text-slate-600 max-w-lg leading-relaxed">
          O "Brain Dump" para o seu cérebro auxiliar. Anote aqui qualquer coisa que esteja ocupando espaço mental sem precisar de uma data de entrega.
        </p>
      </header>

      <section className="bg-white border border-brand-border rounded-[3rem] p-10 shadow-sm space-y-8">
        <form onSubmit={addItem} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-700">O que você está pensando?</label>
            <input 
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Ex: Comprar pilhas para o controle ou Ideia de projeto X..."
              className="w-full bg-zinc-50 p-6 rounded-2xl border border-zinc-100 outline-none focus:border-brand-primary text-xl tracking-tight transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-3 bg-zinc-100 p-1.5 rounded-2xl">
              {(['low', 'medium', 'high'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "px-6 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all",
                    priority === p ? "bg-white shadow-sm text-brand-primary" : "text-slate-500"
                  )}
                >
                  {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                </button>
              ))}
            </div>
            <button 
              type="submit"
              className="px-10 py-4 bg-brand-primary text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Capturar Ideia
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-6">
        <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-90">Capturas Mentais</h3>
        
        <div className="grid grid-cols-1 gap-4">
          <AnimatePresence mode="popLayout">
            {items.map((item) => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={cn(
                  "task-card p-8 bg-white border-brand-border flex items-center justify-between group",
                  item.isPinned && "border-l-4 border-l-brand-primary shadow-md"
                )}
              >
                <div className="flex gap-6 items-start">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                    item.priority === 'high' ? "bg-red-50 text-red-400" : 
                    item.priority === 'medium' ? "bg-brand-primary/10 text-brand-primary" : 
                    "bg-zinc-50 text-slate-500"
                  )}>
                    <BrainCircuit size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xl font-medium text-slate-800 tracking-tight leading-snug">
                      {item.text}
                    </p>
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        Pego {item.createdAt?.toDate().toLocaleDateString('pt-BR')}
                      </p>
                      {item.priority === 'high' && (
                        <span className="text-[8px] font-black uppercase text-red-500 bg-red-50 px-2 py-0.5 rounded">Importante</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => togglePin(item.id, item.isPinned)}
                    className={cn(
                      "p-3 rounded-xl transition-all",
                      item.isPinned ? "text-brand-primary bg-brand-primary/5" : "text-slate-200 hover:text-slate-400"
                    )}
                  >
                    {item.isPinned ? <PinOff size={18} /> : <Pin size={18} />}
                  </button>
                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-3 text-slate-200 hover:text-brand-accent transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {items.length === 0 && !loading && (
            <div className="py-24 text-center opacity-60 bg-zinc-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
               <BrainCircuit size={48} className="mx-auto mb-4" />
               <p className="italic text-xl">Nada para lembrar. Cérebro vazio é cérebro tranquilo.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
