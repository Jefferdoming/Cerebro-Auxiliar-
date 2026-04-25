import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, collection, addDoc, query, where, serverTimestamp, orderBy, limit, deleteDoc } from 'firebase/firestore';
import { 
  Bike, TrendingUp, TrendingDown, Clock, Settings, 
  MapPin, AlertCircle, Plus, Trash2, CheckCircle2,
  Droplets, ShieldCheck, Gauge, Fuel, Navigation, Calendar,
  ArrowRight, Landmark, Zap, Sparkles, Pencil, History,
  Info, ChevronRight, ClipboardList
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile, DeliverySession, MotoMaintenance, MaintenanceLog } from '../types';

export default function MotoboyHub() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [maintenance, setMaintenance] = useState<MotoMaintenance | null>(null);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [deliveries, setDeliveries] = useState<DeliverySession[]>([]);
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [loading, setLoading] = useState(true);

  // Forms
  const [sessionForm, setSessionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    appUsed: 'iFood' as any,
    grossIncome: '',
    tips: '',
    fuelCost: '',
    totalKm: '',
    deliveriesCount: ''
  });

  const [maintForm, setMaintForm] = useState({
    type: 'oil' as any,
    date: new Date().toISOString().split('T')[0],
    km: '',
    description: '',
    cost: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;

    const unsubProfile = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });

    const unsubMaint = onSnapshot(doc(db, 'moto_maintenance', userId), (snap) => {
      if (snap.exists()) {
        setMaintenance(snap.data() as MotoMaintenance);
      } else {
        // Initial setup for Apache 200 2023/24
        const initialMaint: Omit<MotoMaintenance, 'id'> = {
          userId,
          bikeModel: 'Apache 200 RTR',
          year: '2023/24',
          currentKm: 0,
          lastOilChangeKm: 0,
          oilChangeInterval: 3000,
          lastTireChangeKm: 0,
          tireChangeInterval: 15000,
          lastChainLubricationDate: new Date().toISOString().split('T')[0],
          updatedAt: serverTimestamp()
        };
        setDoc(doc(db, 'moto_maintenance', userId), initialMaint);
      }
    });

    const unsubLogs = onSnapshot(
      query(collection(db, 'maintenance_logs'), where('userId', '==', userId), orderBy('date', 'desc'), limit(10)),
      (snap) => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceLog)));
      }
    );

    const unsubDeliveries = onSnapshot(
      query(collection(db, 'deliveries'), where('userId', '==', userId), orderBy('date', 'desc'), limit(5)),
      (snap) => {
        setDeliveries(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeliverySession)));
      }
    );

    setLoading(false);
    return () => { unsubProfile(); unsubMaint(); unsubLogs(); unsubDeliveries(); };
  }, []);

  const handleAddSession = async () => {
    if (!auth.currentUser || !sessionForm.grossIncome) return;
    const gross = parseFloat(sessionForm.grossIncome);
    const tips = parseFloat(sessionForm.tips || '0');
    const fuel = parseFloat(sessionForm.fuelCost || '0');
    const km = parseFloat(sessionForm.totalKm || '0');
    const count = parseInt(sessionForm.deliveriesCount || '0');

    // Add delivery record
    await addDoc(collection(db, 'deliveries'), {
      userId: auth.currentUser.uid,
      ...sessionForm,
      grossIncome: gross,
      tips,
      fuelCost: fuel,
      totalKm: km,
      deliveriesCount: count,
      maintenanceCost: 0,
      status: 'completed',
      createdAt: serverTimestamp()
    });

    // Sync current KM
    if (maintenance && km > 0) {
      const newKm = maintenance.currentKm + km;
      await updateDoc(doc(db, 'moto_maintenance', auth.currentUser.uid), {
        currentKm: newKm,
        updatedAt: serverTimestamp()
      });
    }

    // Add to finance records
    await addDoc(collection(db, 'financial_records'), {
      userId: auth.currentUser.uid,
      type: 'income',
      category: 'delivery',
      amount: gross + tips,
      description: `Sessão Moto: ${sessionForm.appUsed} (${sessionForm.date})`,
      status: 'received',
      dueDate: sessionForm.date,
      priority: 4,
      createdAt: serverTimestamp()
    });

    setIsAddingSession(false);
    setSessionForm({
      date: new Date().toISOString().split('T')[0],
      appUsed: 'iFood',
      grossIncome: '',
      tips: '',
      fuelCost: '',
      totalKm: '',
      deliveriesCount: ''
    });
  };

  const handleAddMaint = async () => {
    if (!auth.currentUser || !maintForm.km) return;
    const kmValue = parseInt(maintForm.km);
    const costValue = parseFloat(maintForm.cost || '0');

    await addDoc(collection(db, 'maintenance_logs'), {
      userId: auth.currentUser.uid,
      ...maintForm,
      km: kmValue,
      cost: costValue,
      createdAt: serverTimestamp()
    });

    // Update maintenance state record
    const updates: any = { 
      currentKm: Math.max(maintenance?.currentKm || 0, kmValue),
      updatedAt: serverTimestamp() 
    };
    if (maintForm.type === 'oil') updates.lastOilChangeKm = kmValue;
    if (maintForm.type === 'tire') updates.lastTireChangeKm = kmValue;
    if (maintForm.type === 'chain') updates.lastChainLubricationDate = maintForm.date;

    await updateDoc(doc(db, 'moto_maintenance', auth.currentUser.uid), updates);

    // Add expense record
    if (costValue > 0) {
      await addDoc(collection(db, 'financial_records'), {
        userId: auth.currentUser.uid,
        type: 'bill',
        category: 'delivery',
        amount: costValue,
        description: `Manutenção Moto: ${maintForm.type} - ${maintForm.description || 'Geral'}`,
        status: 'paid',
        dueDate: maintForm.date,
        priority: 5,
        createdAt: serverTimestamp()
      });
    }

    setIsAddingLog(false);
    setMaintForm({
      type: 'oil',
      date: new Date().toISOString().split('T')[0],
      km: '',
      description: '',
      cost: ''
    });
  };

  const updateCurrentKm = async (newVal: string) => {
    if (!auth.currentUser) return;
    const km = parseInt(newVal);
    if (isNaN(km)) return;
    await updateDoc(doc(db, 'moto_maintenance', auth.currentUser.uid), {
      currentKm: km,
      updatedAt: serverTimestamp()
    });
  };

  const removeLog = async (id: string) => {
    if (!window.confirm('Excluir este registro de manutenção?')) return;
    await deleteDoc(doc(db, 'maintenance_logs', id));
  };

  const removeDelivery = async (id: string) => {
    if (!window.confirm('Excluir esta sessão de entrega?')) return;
    await deleteDoc(doc(db, 'deliveries', id));
  };

  if (loading) return null;

  const oilProgress = maintenance ? (maintenance.currentKm - maintenance.lastOilChangeKm) / maintenance.oilChangeInterval : 0;
  const tireProgress = maintenance ? (maintenance.currentKm - maintenance.lastTireChangeKm) / maintenance.tireChangeInterval : 0;
  
  const earningsTarget = 150; // Manual target example
  const monthEarnings = deliveries.reduce((acc, d) => acc + d.grossIncome + d.tips, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-[#8b5cf6]">
          <Bike size={24} />
          <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Logística Operacional</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-black/5">
          <div className="space-y-1">
            <h1 className="text-5xl font-light tracking-tight">Central do <span className="font-bold whitespace-nowrap">Motoboy</span></h1>
            <p className="text-sm font-medium text-slate-400 uppercase tracking-widest max-w-md">
              Controle de ganhos, gastos e saúde da Apache 200. <br />Segurança é sua maior prioridade.
            </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => setIsAddingSession(true)}
              className="px-8 py-4 bg-[#8b5cf6] text-white rounded-2xl shadow-xl shadow-purple-100 font-bold uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Logar Ganhos
            </button>
          </div>
        </div>
      </header>

      {/* Quick Bike Status */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="adhd-card !p-8 bg-[#1A1A1A] text-white space-y-6 rounded-[2.5rem] relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:rotate-12 transition-transform">
             <Bike size={120} />
          </div>
          <div className="space-y-1 relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sua Moto</p>
            <h3 className="text-2xl font-light">{maintenance?.bikeModel} <span className="font-bold">{maintenance?.year}</span></h3>
          </div>
          <div className="space-y-2 relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Odômetro Atual</p>
            <div className="flex items-end gap-2">
              <input 
                type="number" 
                value={maintenance?.currentKm || 0} 
                onChange={(e) => updateCurrentKm(e.target.value)}
                className="bg-white/5 border border-white/10 text-4xl font-light tracking-tighter w-40 p-2 rounded-xl focus:bg-white/10 outline-none transition-all"
              />
              <span className="text-xl font-light opacity-40 italic mb-2">km</span>
            </div>
          </div>
        </div>

        <div className="adhd-card !p-8 space-y-8 bg-white border-brand-border rounded-[2.5rem]">
           <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-slate-400">Troca de Óleo</span>
                <span className={cn(oilProgress > 0.9 ? "text-red-500" : "text-brand-primary")}>
                   {Math.max(0, (maintenance?.lastOilChangeKm || 0) + (maintenance?.oilChangeInterval || 3000) - (maintenance?.currentKm || 0))} km restam
                </span>
              </div>
              <div className="h-2 bg-zinc-50 rounded-full overflow-hidden border border-zinc-100">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, oilProgress * 100)}%` }}
                  className={cn("h-full transition-colors", oilProgress > 0.9 ? "bg-red-500" : "bg-brand-primary")}
                />
              </div>
              {oilProgress > 0.9 && (
                <div className="flex items-center gap-2 text-[9px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                  <AlertCircle size={12} /> Óleo vencido ou próximo do limite!
                </div>
              )}
           </div>

           <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-slate-400">Pneus</span>
                <span className="text-slate-800">
                   {Math.max(0, (maintenance?.lastTireChangeKm || 0) + (maintenance?.tireChangeInterval || 15000) - (maintenance?.currentKm || 0))} km restam
                </span>
              </div>
              <div className="h-2 bg-zinc-50 rounded-full overflow-hidden border border-zinc-100">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, tireProgress * 100)}%` }}
                  className="h-full bg-slate-300"
                />
              </div>
           </div>
        </div>

        <div className="adhd-card !p-8 bg-emerald-50 border-emerald-100 space-y-6 rounded-[2.5rem]">
           <div className="space-y-1">
             <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Ganhos do Mês (Moto)</p>
             <h4 className="text-4xl font-light tracking-tighter text-emerald-900 leading-none">
               <span className="text-lg opacity-40 mr-1">R$</span>{monthEarnings.toLocaleString('pt-BR')}
             </h4>
           </div>
           <div className="p-4 bg-white/50 rounded-2xl flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Custo Combustível</p>
                <p className="font-bold text-slate-700">R$ {deliveries.reduce((acc, d) => acc + d.fuelCost, 0).toLocaleString('pt-BR')}</p>
              </div>
              <Fuel size={20} className="text-emerald-400" />
           </div>
        </div>
      </section>

      {/* Maintenance Actions */}
      <section className="space-y-6">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40">Prontuário da Apache 200</h3>
          <button 
            onClick={() => setIsAddingLog(true)}
            className="text-[10px] font-bold uppercase tracking-widest text-brand-primary flex items-center gap-2 hover:underline underline-offset-8"
          >
            <Plus size={14} /> Registrar Manutenção
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {logs.length > 0 ? logs.map((log) => (
             <div key={log.id} className="bg-white border border-brand-border p-6 rounded-3xl flex items-center gap-6 group">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                  log.type === 'oil' ? "bg-amber-50 text-amber-500" : 
                  log.type === 'chain' ? "bg-blue-50 text-blue-500" :
                  log.type === 'tire' ? "bg-slate-50 text-slate-500" : "bg-zinc-50 text-zinc-400"
                )}>
                  {log.type === 'oil' ? <Droplets size={20} /> : 
                   log.type === 'chain' ? <Zap size={20} /> :
                   log.type === 'tire' ? <Settings size={20} /> : <ClipboardList size={20} />}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-800 uppercase tracking-tighter text-sm">
                        {log.type === 'oil' ? 'Troca de Óleo' : 
                         log.type === 'chain' ? 'Lubrificação Corrente' :
                         log.type === 'tire' ? 'Troca de Pneu' : log.description}
                      </h5>
                      <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <span>{log.km} KM</span>
                        {log.cost > 0 && <span>• R$ {log.cost}</span>}
                        <span className="text-[9px] font-black opacity-30 italic">{new Date(log.date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeLog(log.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
             </div>
           )) : (
             <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-100 rounded-[2.5rem]">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-20 italic">Nenhum registro de manutenção ainda.</p>
             </div>
           )}
        </div>
      </section>

      {/* Delivery History */}
      <section className="space-y-6">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40 px-2">Histórico de Sessões</h3>
        <div className="space-y-4">
          {deliveries.map((delivery) => (
            <div key={delivery.id} className="bg-white border border-brand-border p-6 rounded-3xl flex items-center justify-between group">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800">R$ {(delivery.grossIncome + (delivery.tips || 0)).toLocaleString('pt-BR')}</p>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">({delivery.appUsed})</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                    {new Date(delivery.date + 'T12:00:00').toLocaleDateString('pt-BR')} • {delivery.totalKm}km • {delivery.deliveriesCount} entregas
                  </p>
                </div>
              </div>
              <button 
                onClick={() => removeDelivery(delivery.id)}
                className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Strategic Insights (Motoboy) */}
      <section className="bg-gradient-to-br from-[#8b5cf6]/5 to-purple-50 p-10 rounded-[3rem] border border-purple-100 space-y-8">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#8b5cf6] shadow-sm">
               <Zap size={24} />
            </div>
            <div className="space-y-1">
               <h3 className="text-xl font-bold tracking-tight text-slate-800">Estratégia <span className="font-light italic">Anti-Burnout</span></h3>
               <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b5cf6]">Blindagem Cognitiva no Trânsito</p>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-[2rem] space-y-2 border border-purple-50">
               <h5 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">O custo da pressa</h5>
               <p className="text-sm text-slate-600 leading-relaxed">Ganhar 2 minutos em uma entrega arriscada aumenta sua carga de cortisol e reduz sua clareza decisória por até 4 horas. O lucro real está na calma.</p>
            </div>
            <div className="p-6 bg-white rounded-[2rem] space-y-2 border border-purple-50">
               <h5 className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Manutenção Preditiva</h5>
               <p className="text-sm text-slate-600 leading-relaxed">Sua Apache 200 é sua ferramenta de liberdade. Parar 15 min para lubrificar a corrente economiza R$ 400 em kit relação no futuro.</p>
            </div>
         </div>
      </section>

      {/* Modals */}
      <AnimatePresence>
        {isAddingSession && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsAddingSession(false)}
            />
            <motion.div 
              initial={{ y: 50, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 50, opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-[3rem] p-12 relative z-10 shadow-2xl space-y-8"
            >
              <header className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#8b5cf6]">Log de Sessão</p>
                <h2 className="text-4xl font-light tracking-tight text-slate-800">Ganhos & <span className="font-bold">Logística</span></h2>
              </header>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest px-1">Data</label>
                    <input type="date" value={sessionForm.date} onChange={e => setSessionForm({...sessionForm, date: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest px-1">App Principal</label>
                    <select value={sessionForm.appUsed} onChange={e => setSessionForm({...sessionForm, appUsed: e.target.value as any})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all">
                      <option value="iFood">iFood</option>
                      <option value="Rappi">Rappi</option>
                      <option value="Uber Eats">Uber Eats</option>
                      <option value="Loggi">Loggi</option>
                      <option value="Particular">Particular</option>
                      <option value="Other">Outro</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest px-1">Ganhos Brutos (R$)</label>
                    <input type="number" placeholder="0.00" value={sessionForm.grossIncome} onChange={e => setSessionForm({...sessionForm, grossIncome: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest px-1">Gorjetas (R$)</label>
                    <input type="number" placeholder="0.00" value={sessionForm.tips} onChange={e => setSessionForm({...sessionForm, tips: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest px-1">Km Rodados</label>
                    <input type="number" placeholder="0" value={sessionForm.totalKm} onChange={e => setSessionForm({...sessionForm, totalKm: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all" />
                  </div>
                   <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest px-1">Gasto Comb. (R$)</label>
                    <input type="number" placeholder="0.00" value={sessionForm.fuelCost} onChange={e => setSessionForm({...sessionForm, fuelCost: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                 <button onClick={() => setIsAddingSession(false)} className="px-8 py-5 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cancelar</button>
                 <button onClick={handleAddSession} className="flex-1 py-5 bg-[#8b5cf6] text-white rounded-2xl shadow-xl shadow-purple-100 font-bold uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-95 transition-all">Salvar Sessão</button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsAddingLog(false)}
            />
            <motion.div 
              initial={{ y: 50, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 50, opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-[3rem] p-12 relative z-10 shadow-2xl space-y-8"
            >
              <header className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary">Manutenção</p>
                <h2 className="text-4xl font-light tracking-tight text-slate-800">Cuidado da <span className="font-bold">Máquina</span></h2>
              </header>

              <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest px-1">Tipo de Serviço</label>
                    <select value={maintForm.type} onChange={e => setMaintForm({...maintForm, type: e.target.value as any})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all">
                      <option value="oil">Troca de Óleo</option>
                      <option value="tire">Troca de Pneu</option>
                      <option value="chain">Corrente (Lubr./Ajuste)</option>
                      <option value="brake">Freios</option>
                      <option value="other">Outros</option>
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest px-1">Data</label>
                    <input type="date" value={maintForm.date} onChange={e => setMaintForm({...maintForm, date: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest px-1">Odômetro (KM)</label>
                    <input type="number" placeholder="0" value={maintForm.km} onChange={e => setMaintForm({...maintForm, km: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest px-1">Descrição / Notas</label>
                  <input type="text" placeholder="Ex: Óleo Motul 10w40, Pneu Pirelli..." value={maintForm.description} onChange={e => setMaintForm({...maintForm, description: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest px-1">Custo (R$)</label>
                  <input type="number" placeholder="0.00" value={maintForm.cost} onChange={e => setMaintForm({...maintForm, cost: e.target.value})} className="w-full bg-zinc-50 border border-zinc-100 p-4 rounded-2xl outline-none focus:border-brand-primary transition-all" />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                 <button onClick={() => setIsAddingLog(false)} className="px-8 py-5 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cancelar</button>
                 <button onClick={handleAddMaint} className="flex-1 py-5 bg-[#1A1A1A] text-white rounded-2xl shadow-xl font-bold uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-95 transition-all">Salvar Manutenção</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
