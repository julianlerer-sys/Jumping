export type LogicType = 'staff' | 'fixed' | 'variable' | 'invoiced' | 'custom';
export type EntryType = 'income' | 'expense';

export interface CustomField {
  key: string;
  label: string;
  type: 'number' | 'text' | 'percentage';
  defaultValue?: any;
}

export interface BudgetCategory {
  id: string;
  name: string;
  type: EntryType;
  logicType: LogicType;
  config: any;
  userId: string;
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  name: string;
  values: any;
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
  fiscalYearStartMonth: number;
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

export interface Provision {
  date: string; // 'YYYY-MM'
  concept: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  type: EntryType;
}

export interface BudgetResult {
  budget: MonthlyBudget[];
  provisions: Provision[];
}
