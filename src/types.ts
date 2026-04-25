export interface UserProfile {
  userId: string;
  name: string;
  role: 'user' | 'professor';
  secondaryRole?: 'motoboy' | 'none';
  onboardingComplete: boolean;
  energyLevel?: 'low' | 'medium' | 'high';
  crisisMode?: boolean;
  lastActiveDate?: string;
  createdAt: Date;
  preferences?: {
    dailyClasses?: boolean;
    deliveryWork?: boolean;
    financialAlerts?: boolean;
  };
}

export interface Task {
  id: string;
  userId: string;
  content: string;
  completed: boolean;
  date: string; // YYYY-MM-DD
  difficulty?: number; // 1-5
  originalContent?: string;
  reductionLevel?: number;
  createdAt: Date;
}

export interface CortexInput {
  energia: 'low' | 'medium' | 'high';
  estado_emocional: 'ok' | 'travado' | 'crise';
  tentativas_falha: number;
  tempo_inativo_min: number;
  tipo_evento: 'abrir_app' | 'iniciar_tarefa' | 'nao_consegui' | 'crise' | 'retorno' | 'financeiro' | 'foco_executivo';
  tarefa: string;
}

export interface CortexResponse {
  mensagens: string[];
  acao: string;
  botao: string;
  nivel: 'micro' | 'normal';
  interface: 'normal' | 'reduzida';
}

export interface FinanceData {
  userId: string;
  totalDebt: number;
  monthlyMeta: number;
  lastImpulseCheck: Date;
}

export interface FinancialRecord {
  id: string;
  userId: string;
  type: 'income' | 'bill' | 'debt';
  category?: 'delivery' | 'school' | 'other' | 'personal' | 'household';
  amount: number;
  description: string;
  dueDate?: string;
  status: 'pending' | 'paid' | 'received';
  priority?: number; // 1-5
  createdAt: any;
}

export interface DeliverySession {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime?: string;
  deliveriesCount: number;
  totalKm: number;
  grossIncome: number;
  fuelCost: number;
  maintenanceCost: number;
  tips: number;
  appUsed: 'iFood' | 'Rappi' | 'Uber Eats' | 'Loggi' | 'Particular' | 'Other';
  status: 'active' | 'completed';
  createdAt: any;
}

export interface Loan {
  id: string;
  userId: string;
  description: string;
  totalAmount: number;
  monthlyAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  interestRate?: number;
  priority?: number; // 1-5
  createdAt: Date;
}

export interface Investment {
  id: string;
  userId: string;
  description: string;
  amount: number;
  type: 'capitalization' | 'piggybank' | 'other';
  totalInstallments?: number;
  paidInstallments?: number;
  monthlyContribution?: number;
  priority?: number; // 1-5
  createdAt: Date;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  type: 'school' | 'health' | 'delivery' | 'personal';
  category?: string; // School Name or Class
  notes?: string;
  isRecurring?: boolean; // Repeat weekly
  dayOfWeek?: number; // 0-6
  createdAt: Date;
}

export interface HabitStep {
  id: string;
  label: string;
  level: number; // 1 = ultra minimal, progressive up to 5+
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  type: 'SAVERS' | 'MICRO' | 'EFFECTIVE' | 'ADAPTIVE';
  completedDates: string[];
  streak: number;
  steps?: HabitStep[];
  currentStepIndex?: number;
  adaptiveLevel?: number; // 1-10
  lastFailureDate?: string;
  lastReinforcementMsg?: string;
  createdAt: Date;
}

export interface DailyCommitment {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  microHabit: string;
  isCompleted: boolean;
  reflection: string;
  createdAt: any;
}

export interface JournalEntry {
  id: string;
  userId: string;
  content: string; // anseios, medos, receios
  insight?: string;
  actionGuidance?: {
    task: string;
    description: string;
    options: {
      label: string;
      description: string;
    }[];
  };
  date: string; // YYYY-MM-DD
  createdAt: any;
}

export interface MotoMaintenance {
  id: string;
  userId: string;
  bikeModel: string;
  year: string;
  currentKm: number;
  lastOilChangeKm: number;
  oilChangeInterval: number;
  lastTireChangeKm: number;
  tireChangeInterval: number;
  lastChainLubricationDate: string;
  updatedAt: any;
}

export interface MaintenanceLog {
  id: string;
  userId: string;
  type: 'oil' | 'tire' | 'chain' | 'brake' | 'other';
  km: number;
  date: string;
  description: string;
  cost: number;
  createdAt: any;
}
