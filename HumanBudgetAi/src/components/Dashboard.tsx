import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { BudgetCategory, BudgetItem, Invoice, MonthlyBudget, UserSettings } from '../types';
import { calculateBudget } from '../lib/budgetLogic';
import { format, startOfMonth, setMonth, setYear, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { TrendingUp, TrendingDown, Wallet, Calendar, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Dashboard() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const qCat = query(collection(db, 'budgetCategories'), where('userId', '==', user.uid));
    const qItems = query(collection(db, 'budgetItems'), where('userId', '==', user.uid));
    const qInv = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    const qSettings = query(collection(db, 'settings'), where('userId', '==', user.uid));

    const unsubCat = onSnapshot(qCat, 
      (s) => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() } as BudgetCategory))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'budgetCategories')
    );
    const unsubItems = onSnapshot(qItems, 
      (s) => setItems(s.docs.map(d => ({ id: d.id, ...d.data() } as BudgetItem))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'budgetItems')
    );
    const unsubInv = onSnapshot(qInv, 
      (s) => setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );
    const unsubSettings = onSnapshot(qSettings, (s) => {
      if (!s.empty) {
        setSettings({ id: s.docs[0].id, ...s.docs[0].data() } as UserSettings);
      } else {
        setSettings({ fiscalYearStartMonth: 7, fiscalYearStartDay: 1, userId: user.uid });
      }
    });

    return () => {
      unsubCat();
      unsubItems();
      unsubInv();
      unsubSettings();
    };
  }, [user]);

  const defaultFiscalYear = new Date().getMonth() < (settings?.fiscalYearStartMonth ?? 7) 
    ? new Date().getFullYear() - 1 
    : new Date().getFullYear();

  const activeYear = settings?.fiscalYearStartYear ?? defaultFiscalYear;

  const startDate = settings 
    ? startOfMonth(setMonth(setYear(new Date(), activeYear), settings.fiscalYearStartMonth))
    : startOfMonth(new Date(new Date().getFullYear(), 0, 1));

  const updateSettings = async (newStartMonth: number, newStartYear: number) => {
    if (!user) return;
    try {
      if (settings?.id) {
        await updateDoc(doc(db, 'settings', settings.id), { 
          fiscalYearStartMonth: newStartMonth,
          fiscalYearStartYear: newStartYear
        });
      } else {
        await addDoc(collection(db, 'settings'), {
          fiscalYearStartMonth: newStartMonth,
          fiscalYearStartYear: newStartYear,
          fiscalYearStartDay: 1,
          userId: user.uid
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
    }
  };

  const shiftYear = (delta: number) => {
    updateSettings(settings?.fiscalYearStartMonth || 0, activeYear + delta);
  };

  const budget = calculateBudget(categories, items, invoices, startDate);

  const chartData = Array.from({ length: 12 }, (_, i) => {
    const currentMonthDate = addMonths(startDate, i);
    const m = currentMonthDate.getMonth();
    const y = currentMonthDate.getFullYear();

    const monthEntries = budget.filter(b => b.month === m && b.year === y);
    const income = monthEntries.filter(b => b.type === 'income').reduce((sum, b) => sum + b.amount, 0);
    const expense = monthEntries.filter(b => b.type === 'expense').reduce((sum, b) => sum + b.amount, 0);

    return {
      name: format(currentMonthDate, 'MMM yy', { locale: es }),
      income,
      expense,
      balance: income - expense
    };
  });

  const totalIncome = chartData.reduce((sum, d) => sum + d.income, 0);
  const totalExpense = chartData.reduce((sum, d) => sum + d.expense, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Presupuesto Anual</h1>
          <div className="flex items-center gap-3 mt-1">
            <button onClick={() => shiftYear(-1)} className="p-1 hover:bg-zinc-200 rounded-md transition-colors text-zinc-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-zinc-500 font-medium">Periodo: {format(startDate, 'MMMM yyyy', { locale: es })} - {format(addMonths(startDate, 11), 'MMMM yyyy', { locale: es })}</p>
            <button onClick={() => shiftYear(1)} className="p-1 hover:bg-zinc-200 rounded-md transition-colors text-zinc-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="flex items-center gap-2 bg-white border border-zinc-200 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-zinc-50 transition-colors"
          >
            <Calendar className="w-4 h-4 text-sky-600" />
            Configurar Periodo
          </button>

          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-72 bg-white rounded-2xl border border-zinc-200 shadow-xl z-50 p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-zinc-900" />
                  <h3 className="font-bold text-sm">Año Fiscal / Académico</h3>
                </div>
                <p className="text-xs text-zinc-500 mb-4">Selecciona el mes en el que comienza tu presupuesto anual.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Mes de inicio</label>
                    <select 
                      className="w-full text-sm p-2 bg-zinc-50 border border-zinc-200 rounded-lg outline-hidden"
                      value={settings?.fiscalYearStartMonth || 0}
                      onChange={(e) => updateSettings(Number(e.target.value), activeYear)}
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i} value={i}>
                          {format(setMonth(new Date(), i), 'MMMM', { locale: es })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Año de inicio</label>
                    <select 
                      className="w-full text-sm p-2 bg-zinc-50 border border-zinc-200 rounded-lg outline-hidden"
                      value={activeYear}
                      onChange={(e) => updateSettings(settings?.fiscalYearStartMonth || 0, Number(e.target.value))}
                    >
                      {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[10px] text-zinc-400 italic mt-2">
                    * El presupuesto recalculará automáticamente los 12 meses a partir de este mes y año.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Ingresos Totales" 
          value={totalIncome} 
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} 
          color="emerald"
        />
        <StatCard 
          title="Gastos Totales" 
          value={totalExpense} 
          icon={<TrendingDown className="w-5 h-5 text-rose-500" />} 
          color="rose"
        />
        <StatCard 
          title="Balance Neto" 
          value={totalIncome - totalExpense} 
          icon={<Wallet className="w-5 h-5 text-zinc-500" />} 
          color="zinc"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            Distribución Mensual
            <span className="text-xs font-normal text-zinc-400 font-mono">CASHFLOW</span>
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(value) => `${value}€`} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar name="Ingresos" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar name="Gastos" dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
            Evolución de Balance
            <span className="text-xs font-normal text-zinc-400 font-mono">TRENDS</span>
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Line type="monotone" name="Balance" dataKey="balance" stroke="#18181b" strokeWidth={2} dot={{ r: 4, fill: '#18181b' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          Detalle por Categoría
          <span className="text-xs font-normal text-zinc-400 font-mono">BREAKDOWN</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="py-3 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Categoría</th>
                {chartData.map((d, i) => (
                  <th key={i} className="py-3 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">
                    {d.name.split(' ')[0]}
                    <span className="block text-[8px] opacity-50">{d.name.split(' ')[1]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-medium text-sm">{cat.name}</span>
                    <span className={`ml-2 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${cat.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-50 text-zinc-500'}`}>
                      {cat.type === 'income' ? 'I' : 'G'}
                    </span>
                  </td>
                  {chartData.map((_, i) => {
                    const currentMonthDate = addMonths(startDate, i);
                    const m = currentMonthDate.getMonth();
                    const y = currentMonthDate.getFullYear();
                    const amount = budget.find(b => b.categoryId === cat.id && b.month === m && b.year === y)?.amount || 0;
                    
                    return (
                      <td key={i} className="py-3 px-4 text-right">
                        <span className={`font-mono text-xs ${amount > 0 ? 'text-zinc-900' : 'text-zinc-300'}`}>
                          {amount > 0 ? new Intl.NumberFormat('es-ES').format(amount) : '-'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-zinc-50/80 font-bold border-t-2 border-zinc-200">
               <tr>
                 <td className="py-3 px-4 text-sm uppercase">Total Caja</td>
                 {chartData.map((d, i) => (
                   <td key={i} className="py-3 px-4 text-right font-mono text-sm">
                      <span className={d.income - d.expense >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                        {new Intl.NumberFormat('es-ES').format(d.income - d.expense)}€
                      </span>
                   </td>
                 ))}
               </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: any, color: string }) {
  const isPositive = value >= 0;
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-zinc-500 uppercase tracking-wider">{title}</span>
        <div className={`p-2 rounded-xl bg-${color}-50`}>
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold font-mono">
          {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)}
        </span>
      </div>
    </motion.div>
  );
}
