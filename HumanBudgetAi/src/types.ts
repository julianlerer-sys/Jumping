export type LogicType = 'staff' | 'fixed' | 'variable' | 'invoiced';
export type EntryType = 'income' | 'expense';

export interface BudgetCategory {
  id: string;
  name: string;
  type: EntryType;
  logicType: LogicType;
  config: any; // E.g. { ssPercentage: 0.3 } for staff
  userId: string;
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  name: string;
  values: any; // E.g. { salary: 2000 }
  userId: string;
}

export interface Invoice {
  id: string;
  categoryId: string;
  description: string;
  amount: number;
  date: string;
  status: 'predicted' | 'paid';
  userId: string;
}

export interface UserSettings {
  id?: string;
  fiscalYearStartMonth: number; // 0-11
  fiscalYearStartYear?: number;
  fiscalYearStartDay: number;
  userId: string;
}

export interface MonthlyBudget {
  month: number; // 0-11
  year: number;
  amount: number;
  type: EntryType;
  categoryId: string;
  categoryName: string;
}
