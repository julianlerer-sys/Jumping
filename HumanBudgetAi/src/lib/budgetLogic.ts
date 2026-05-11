import { BudgetCategory, BudgetItem, MonthlyBudget, Invoice } from '../types';
import { addMonths, getMonth, getYear, parseISO, startOfMonth, format } from 'date-fns';

export function calculateBudget(
  categories: BudgetCategory[],
  items: BudgetItem[],
  invoices: Invoice[],
  startDate: Date
): MonthlyBudget[] {
  const result: MonthlyBudget[] = [];
  const initialDate = startOfMonth(startDate);

  categories.forEach(cat => {
    const catItems = items.filter(i => i.categoryId === cat.id);
    const catInvoices = invoices.filter(i => i.categoryId === cat.id);

    for (let i = 0; i < 12; i++) {
      const currentPeriodDate = addMonths(initialDate, i);
      const m = getMonth(currentPeriodDate);
      const y = getYear(currentPeriodDate);
      
      let monthlyTotal = 0;

      if (cat.logicType === 'staff') {
        const ssRatio = 1 + Number(cat.config?.ssPercentage || 0.3);
        catItems.forEach(item => {
          const baseSalary = Number(item.values?.salary || 0);
          let currentSalary = baseSalary;
          
          const updates = [...(item.values?.salaryUpdates || [])].sort((a, b) => a.date.localeCompare(b.date));
          
          // Use YYYY-MM for the target month comparison
          const targetMonthStr = format(currentPeriodDate, 'yyyy-MM');

          updates.forEach(update => {
            // update.date is YYYY-MM-DD, so we take the first 7 chars for YYYY-MM
            const updateMonthStr = update.date.substring(0, 7);
            
            if (updateMonthStr <= targetMonthStr) {
              const val = Number(update.value) || 0;
              const type = String(update.type).trim().toLowerCase();
              if (type === 'amount') {
                currentSalary += val;
              } else if (type === 'percent') {
                currentSalary *= (1 + (val / 100));
              }
            }
          });

          const itemTotal = currentSalary * ssRatio;
          monthlyTotal += itemTotal;
          
          // Debugging helper
          if (updates.length > 0 && (i === 0 || i === 11 || targetMonthStr.endsWith('-01'))) {
             console.log(`[Staff] ${item.name} (${targetMonthStr}): Base ${baseSalary} -> Current ${currentSalary.toFixed(2)} (Total w/SS: ${itemTotal.toFixed(2)})`);
          }
        });
      } else if (cat.logicType === 'fixed') {
        catItems.forEach(item => {
          monthlyTotal += Number(item.values?.amount || 0);
        });
      } else if (cat.logicType === 'invoiced') {
        catInvoices.forEach(inv => {
          const invDate = parseISO(inv.date);
          if (getMonth(invDate) === m && getYear(invDate) === y) {
            monthlyTotal += inv.amount;
          }
        });
      } else if (cat.logicType === 'variable') {
        catItems.forEach(item => {
          const monthlyValues = item.values?.monthly || {};
          monthlyTotal += Number(monthlyValues[m] || 0);
        });
      }

      result.push({
        month: m,
        year: y,
        amount: monthlyTotal,
        type: cat.type,
        categoryId: cat.id,
        categoryName: cat.name
      });
    }
  });

  return result;
}
