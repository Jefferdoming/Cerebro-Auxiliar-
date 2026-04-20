import { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, addDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Plus, Trash2, Calendar, ListTodo } from 'lucide-react';
import { Task } from '../types';

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', auth.currentUser.uid),
      where('date', '==', today)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    });

    return unsub;
  }, []);

  const addTask = async () => {
    if (!newTask.trim() || tasks.length >= 5 || !auth.currentUser) return;
    await addDoc(collection(db, 'tasks'), {
      userId: auth.currentUser.uid,
      content: newTask,
      completed: false,
      date: new Date().toISOString().split('T')[0],
      createdAt: serverTimestamp()
    });
    setNewTask('');
  };

  const toggleTask = async (task: Task) => {
    await updateDoc(doc(db, 'tasks', task.id), { completed: !task.completed });
  };

  const removeTask = async (id: string) => {
    await deleteDoc(doc(db, 'tasks', id));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <header className="space-y-4">
        <h1 className="text-5xl font-light tracking-tight">Rotina <span className="font-bold whitespace-nowrap">Simplificada</span></h1>
        <div className="flex items-center justify-between border-b border-black/5 pb-6">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest leading-relaxed">
            Limite de 5 coisas. <br />Escolha com sabedoria.
          </p>
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Status: {tasks.length}/5 Objetivos</span>
          </div>
        </div>
      </header>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="O que você precisa concluir hoje?"
          className="flex-1 bg-white p-6 rounded-2xl border border-brand-border outline-none focus:border-brand-primary transition-colors text-lg tracking-tight shadow-sm"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          disabled={tasks.length >= 5}
        />
        <button 
          onClick={addTask}
          disabled={tasks.length >= 5}
          className="bg-brand-primary text-white p-6 rounded-2xl shadow-xl disabled:bg-slate-200 transition-all active:scale-95"
        >
          <Plus size={28} />
        </button>
      </div>

      <div className="space-y-4">
        {tasks.map((task) => (
          <motion.div
            layout
            key={task.id}
            className="task-card flex items-center gap-6 p-6 group"
          >
            <button onClick={() => toggleTask(task)} className="text-brand-primary transition-transform active:scale-110">
              {task.completed ? <CheckCircle2 size={28} /> : <div className="w-7 h-7 border-2 border-slate-200 rounded transition-colors group-hover:border-brand-primary" />}
            </button>
            <span className={`flex-1 text-xl font-medium tracking-tight ${task.completed ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
              {task.content}
            </span>
            <button onClick={() => removeTask(task.id)} className="text-slate-300 hover:text-brand-accent transition-colors">
              <Trash2 size={20} />
            </button>
          </motion.div>
        ))}
        {Array.from({ length: 5 - tasks.length }).map((_, i) => (
          <div key={i} className="adhd-card !py-6 border-dashed border-2 bg-transparent opacity-10 text-slate-400 text-center font-bold uppercase tracking-widest text-xs">
            Slot Disponível
          </div>
        ))}
      </div>

      <div className="bg-zinc-50 border border-brand-border p-8 rounded-[2rem] flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-brand-primary shrink-0 shadow-sm">
          <Calendar size={32} strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary opacity-40">Dica TCC / Métodos</p>
          <p className="text-lg font-medium text-slate-600 tracking-tight leading-relaxed">
            "Divida tarefas grandes em micro-ações de 5 minutos para reduzir a barreira de início."
          </p>
        </div>
      </div>
    </div>

  );
}
