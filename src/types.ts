export interface UserProfile {
  userId: string;
  name: string;
  role: 'user' | 'professor';
  onboardingComplete: boolean;
  createdAt: Date;
}

export interface Task {
  id: string;
  userId: string;
  content: string;
  completed: boolean;
  date: string; // YYYY-MM-DD
  createdAt: Date;
}

export interface FinanceData {
  userId: string;
  totalDebt: number;
  monthlyMeta: number;
  lastImpulseCheck: Date;
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
  createdAt: Date;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  type: 'SAVERS' | 'MICRO' | 'EFFECTIVE';
  completedDates: string[];
  streak: number;
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
