import { BudgetCategory, BudgetItem, MonthlyBudget, Invoice, Provision, BudgetResult } from '../types';
import { addMonths, getMonth, getYear, parseISO, startOfMonth, format } from 'date-fns';

function runCustomLogic(
  fnString: string,
  ctx: { month: number; year: number; items: BudgetItem[]; invoices: Invoice[] }
): { amount: number; provisions: Array<{ date: string; concept: string; amount: number }> } {
  try {
    // eslint-disable-next-line no-new-func
    const runner = new Function('ctx', `
      "use strict";
      const {month, year, items, invoices} = ctx;
      ${fnString}
      return typeof calculate === 'function' ? calculate(ctx) : { amount: 0, provisions: [] };
    `);
    const result = runner(ctx);
    return {
      amount: typeof result?.amount === 'number' ? result.amount : 0,
      provisions: Array.isArray(result?.provisions) ? result.provisions : []
    };
  } catch (e) {
    console.error('Custom logic error:', e);
    return { amount: 0, provisions: [] };
  }
}

export function calculateBudget(
  categories: BudgetCategory[],
  items: BudgetItem[],
  invoices: Invoice[],
  startDate: Date
): BudgetResult {
  const budget: MonthlyBudget[] = [];
  const provisionsMap = new Map<string, Provision>();
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
          const targetMonthStr = format(currentPeriodDate, 'yyyy-MM');

          updates.forEach(update => {
            const updateMonthStr = update.date.substring(0, 7);
            if (updateMonthStr <= targetMonthStr) {
              const val = Number(update.value) || 0;
              const type = String(update.type).trim().toLowerCase();
              if (type === 'amount') currentSalary += val;
              else if (type === 'percent') currentSalary *= (1 + (val / 100));
            }
          });

          const itemTotal = currentSalary * ssRatio;
          monthlyTotal += itemTotal;

          // One-time bonuses (also subject to SS)
          const bonuses = item.values?.bonuses || [];
          bonuses.forEach((bonus: any) => {
            if (bonus.date?.substring(0, 7) === targetMonthStr) {
              monthlyTotal += Number(bonus.amount || 0) * ssRatio;
            }
          });

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
      } else if (cat.logicType === 'artistic') {
        const irpfRate = Number(cat.config?.irpfRate || 0.15);
        const ivaRate = Number(cat.config?.ivaRate || 0.21);

        // Monthly budget = base + IVA (full invoice amount)
        catItems.forEach(item => {
          const base = Number(item.values?.monthly?.[m] || 0);
          monthlyTotal += base * (1 + ivaRate);
        });

        // IRPF provision at end of each calendar quarter (on base, not IVA)
        const quarter = Math.floor(m / 3);
        if (m === quarter * 3 + 2) {
          let quarterBase = 0;
          for (let qm = quarter * 3; qm <= m; qm++) {
            catItems.forEach(item => {
              quarterBase += Number(item.values?.monthly?.[qm] || 0);
            });
          }
          const provisionAmount = quarterBase * irpfRate;
          if (provisionAmount > 0) {
            const nextMonth = m + 1;
            const provYear = nextMonth >= 12 ? y + 1 : y;
            const provMonth = String((nextMonth % 12) + 1).padStart(2, '0');
            const provDate = `${provYear}-${provMonth}`;
            provisionsMap.set(`${cat.id}|${provDate}|IRPF Profesionales T${quarter + 1}`, {
              date: provDate,
              concept: `IRPF Profesionales T${quarter + 1}`,
              amount: provisionAmount,
              categoryId: cat.id,
              categoryName: cat.name,
              type: cat.type
            });
          }
        }
      } else if (cat.logicType === 'custom' && cat.config?.customFunction) {
        const result = runCustomLogic(cat.config.customFunction, {
          month: m, year: y, items: catItems, invoices: catInvoices
        });
        monthlyTotal = result.amount;

        result.provisions.forEach(p => {
          const key = `${cat.id}|${p.date}|${p.concept}`;
          provisionsMap.set(key, {
            date: p.date,
            concept: p.concept,
            amount: p.amount,
            categoryId: cat.id,
            categoryName: cat.name,
            type: cat.type
          });
        });
      }

      budget.push({
        month: m,
        year: y,
        amount: monthlyTotal,
        type: cat.type,
        categoryId: cat.id,
        categoryName: cat.name
      });
    }
  });

  return {
    budget,
    provisions: Array.from(provisionsMap.values()).sort((a, b) => a.date.localeCompare(b.date))
  };
}
