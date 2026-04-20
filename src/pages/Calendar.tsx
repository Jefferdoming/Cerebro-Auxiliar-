import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  GraduationCap, 
  Stethoscope, 
  Bike, 
  User,
  Clock,
  MapPin,
  Trash2,
  Calendar as CalendarIcon
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { CalendarEvent } from '../types';
import { cn } from '../lib/utils';

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    type: 'school' as const,
    category: '',
    startTime: '',
    notes: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Listen for all events for the current user
    const q = query(collection(db, 'events'), where('userId', '==', auth.currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
    });

    return unsub;
  }, []);

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-12">
        <header className="space-y-4">
          <h1 className="text-5xl font-light tracking-tight">Minha <span className="font-bold">Agenda</span></h1>
          <p className="text-sm font-medium text-slate-400 uppercase tracking-widest border-b border-black/5 pb-4">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </p>
        </header>
        <div className="flex gap-4">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-4 bg-white border border-brand-border rounded-2xl hover:bg-zinc-50 transition-all active:scale-95"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-4 bg-white border border-brand-border rounded-2xl hover:bg-zinc-50 transition-all active:scale-95"
          >
            <ChevronRight size={24} />
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="p-4 bg-brand-primary text-white rounded-2xl shadow-xl shadow-brand-primary/10 hover:scale-105 transition-all active:scale-95"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return (
      <div className="grid grid-cols-7 mb-4">
        {days.map((day, i) => (
          <div key={i} className="text-[10px] font-bold uppercase tracking-[0.2em] text-center text-slate-300">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm">
        {calendarDays.map((date, i) => {
          const dayEvents = events.filter(e => e.date === format(date, 'yyyy-MM-dd'));
          const isSelected = isSameDay(date, selectedDate);
          const isCurrentMonth = isSameMonth(date, monthStart);
          
          return (
            <div
              key={i}
              className={cn(
                "min-h-[120px] bg-white p-4 cursor-pointer transition-all hover:bg-zinc-50 relative",
                !isCurrentMonth ? "bg-zinc-50 text-slate-200" : "text-slate-700",
                isSelected ? "ring-2 ring-brand-primary ring-inset z-10" : ""
              )}
              onClick={() => setSelectedDate(date)}
            >
              <span className={cn(
                "text-sm font-bold",
                isSelected ? "text-brand-primary" : ""
              )}>
                {format(date, dateFormat)}
              </span>
              <div className="mt-2 space-y-1">
                {dayEvents.slice(0, 3).map((event, j) => (
                  <div 
                    key={j} 
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md truncate",
                      event.type === 'school' ? "bg-blue-50 text-blue-600" :
                      event.type === 'health' ? "bg-green-50 text-green-600" :
                      event.type === 'delivery' ? "bg-orange-50 text-orange-600" :
                      "bg-slate-100 text-slate-600"
                    )}
                  >
                    {event.startTime && `${event.startTime} `}{event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] font-bold text-slate-300 pl-1">
                    + {dayEvents.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleAddEvent = async () => {
    if (!auth.currentUser || !newEvent.title) return;
    
    await addDoc(collection(db, 'events'), {
      userId: auth.currentUser.uid,
      title: newEvent.title,
      date: format(selectedDate, 'yyyy-MM-dd'),
      type: newEvent.type,
      category: newEvent.category,
      startTime: newEvent.startTime,
      notes: newEvent.notes,
      createdAt: serverTimestamp()
    });

    setIsAddModalOpen(false);
    setNewEvent({ title: '', type: 'school', category: '', startTime: '', notes: '' });
  };

  const deleteEvent = async (id: string) => {
    await deleteDoc(doc(db, 'events', id));
  };

  const selectedDateEvents = events.filter(e => e.date === format(selectedDate, 'yyyy-MM-dd'));

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-24">
      {renderHeader()}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Calendar Grid */}
        <div className="lg:col-span-8 space-y-8">
          {renderDays()}
          {renderCells()}
          
          {/* Legend */}
          <div className="flex flex-wrap gap-8 pt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Escola / Aula</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Saúde / Consulta</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Entregas Moto</span>
            </div>
          </div>
        </div>

        {/* Selected Day Details */}
        <div className="lg:col-span-4 space-y-8">
          <header className="pb-6 border-b border-black/5">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-primary mb-2">Detalhes de Hoje</p>
            <h2 className="text-3xl font-light tracking-tight">
              {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </h2>
          </header>

          <div className="space-y-4">
            {selectedDateEvents.length > 0 ? selectedDateEvents.map((event) => (
              <motion.div 
                layout
                key={event.id}
                className="task-card p-6 bg-white border border-brand-border space-y-3 group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      event.type === 'school' ? "bg-blue-50 text-blue-600" :
                      event.type === 'health' ? "bg-green-50 text-green-600" :
                      event.type === 'delivery' ? "bg-orange-50 text-orange-600" :
                      "bg-slate-100 text-slate-600"
                    )}>
                      {event.type === 'school' && <GraduationCap size={20} />}
                      {event.type === 'health' && <Stethoscope size={20} />}
                      {event.type === 'delivery' && <Bike size={20} />}
                      {event.type === 'personal' && <User size={20} />}
                    </div>
                    <div>
                      <h4 className="font-bold tracking-tight text-slate-800">{event.title}</h4>
                      {event.category && (
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{event.category}</p>
                      )}
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteEvent(event.id)}
                    className="text-slate-200 hover:text-brand-accent transition-all p-2 rounded-xl hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-4 pt-2">
                  {event.startTime && (
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <Clock size={12} /> {event.startTime}
                    </div>
                  )}
                  {event.notes && (
                    <div className="w-full text-sm text-slate-500 leading-relaxed italic border-l-2 border-slate-100 pl-4 mt-2">
                      {event.notes}
                    </div>
                  )}
                </div>
              </motion.div>
            )) : (
              <div className="adhd-card !p-12 text-center border-dashed border-2 opacity-20">
                <CalendarIcon className="mx-auto mb-4" size={32} />
                <p className="text-sm italic">Nada agendado para este dia.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-12 relative z-10 shadow-2xl space-y-8">
              <header className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Novo Compromisso</p>
                <h2 className="text-4xl font-light tracking-tight text-slate-800">Minha <span className="font-bold">Ação</span></h2>
              </header>

              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-2 p-1.5 bg-zinc-100 rounded-2xl">
                  {[
                    { val: 'school', icon: GraduationCap, label: 'Aula' },
                    { val: 'health', icon: Stethoscope, label: 'Saúde' },
                    { val: 'delivery', icon: Bike, label: 'Moto' },
                    { val: 'personal', icon: User, label: 'Geral' }
                  ].map(t => (
                    <button 
                      key={t.val} 
                      onClick={() => setNewEvent({...newEvent, type: t.val as any})} 
                      className={cn(
                        "flex flex-col items-center gap-1 py-3 text-[8px] font-bold uppercase tracking-widest rounded-xl transition-all", 
                        newEvent.type === t.val ? "bg-white shadow-sm text-brand-primary" : "text-slate-400"
                      )}
                    >
                      <t.icon size={16} />
                      {t.label}
                    </button>
                  ))}
                </div>

                <input 
                  placeholder="Título do compromisso" 
                  className="w-full bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none focus:border-black text-lg tracking-tight" 
                  value={newEvent.title} 
                  onChange={e => setNewEvent({...newEvent, title: e.target.value})} 
                />

                <div className="flex gap-4">
                  <input 
                    placeholder="Escola/Local" 
                    className="w-1/2 bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none" 
                    value={newEvent.category} 
                    onChange={e => setNewEvent({...newEvent, category: e.target.value})} 
                  />
                  <input 
                    type="time" 
                    className="w-1/2 bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none font-bold" 
                    value={newEvent.startTime} 
                    onChange={e => setNewEvent({...newEvent, startTime: e.target.value})} 
                  />
                </div>

                <textarea 
                  placeholder="Observações ou lembretes (opcional)..." 
                  rows={3}
                  className="w-full bg-zinc-50 p-5 rounded-2xl border border-zinc-100 outline-none resize-none" 
                  value={newEvent.notes} 
                  onChange={e => setNewEvent({...newEvent, notes: e.target.value})} 
                />
              </div>

              <button 
                onClick={handleAddEvent}
                className="w-full py-6 bg-brand-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
              >
                Agendar Agora
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
