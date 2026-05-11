import { calculateBudget } from './src/lib/budgetLogic.js';
import { BudgetCategory, BudgetItem } from './src/types.js';

const mockCategories: BudgetCategory[] = [
  { id: 'c1', name: 'Staff', type: 'expense', logicType: 'staff', config: { ssPercentage: 0.3 }, userId: '1' }
];

const mockItems: BudgetItem[] = [
  {
    id: 'i1', categoryId: 'c1', name: 'John', userId: '1',
    values: {
      salary: 1000,
      salaryUpdates: [
        { date: '2026-03-15', type: 'amount', value: 100 }
      ]
    }
  }
];

const { budget } = calculateBudget(mockCategories, mockItems, [], new Date('2026-01-01'));
console.log(budget.map(b => `${b.year}-${b.month + 1}: ${b.amount}`));
