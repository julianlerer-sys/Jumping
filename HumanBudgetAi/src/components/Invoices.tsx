import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { BudgetCategory, Invoice } from '../types';
import { Plus, Trash2, CheckCircle, Clock, Search, Download, FileJson } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import Papa from 'papaparse';

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [filter, setFilter] = useState<'all' | 'predicted' | 'paid'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [newInv, setNewInv] = useState({
    categoryId: '',
    description: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    if (!user) return;
    const qCat = query(collection(db, 'budgetCategories'), where('userId', '==', user.uid));
    const qInv = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    
    const unsubCat = onSnapshot(qCat, 
      (s) => {
        const cats = s.docs.map(d => ({ id: d.id, ...d.data() } as BudgetCategory));
        setCategories(cats);
        if (cats.length > 0 && !newInv.categoryId) setNewInv(prev => ({ ...prev, categoryId: cats[0].id }));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'budgetCategories')
    );
    const unsubInv = onSnapshot(qInv, 
      (s) => setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    return () => { unsubCat(); unsubInv(); };
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newInv.categoryId || !newInv.amount) return;

    try {
      await addDoc(collection(db, 'invoices'), {
        ...newInv,
        status: 'predicted',
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invoices');
    }

    setIsAdding(false);
    setNewInv({ ...newInv, description: '', amount: 0 });
  };

  const toggleStatus = async (id: string, current: string) => {
    try {
      await updateDoc(doc(db, 'invoices', id), {
        status: current === 'paid' ? 'predicted' : 'paid'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `invoices/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invoices', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `invoices/${id}`);
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        for (const row of rows) {
          // Attempt to find or fallback category
          const category = categories.find(c => c.name.toLowerCase() === row.categoria?.toLowerCase()) || categories[0];
          if (!category) continue;

          await addDoc(collection(db, 'invoices'), {
            categoryId: category.id,
            description: row.descripcion || row.description || 'Importado CSV',
            amount: Number(row.cantidad || row.amount || 0),
            date: row.fecha || row.date || format(new Date(), 'yyyy-MM-dd'),
            status: row.estado?.toLowerCase() === 'pagado' ? 'paid' : 'predicted',
            userId: user.uid,
            createdAt: new Date().toISOString()
          });
        }
      }
    });
  };

  const downloadTemplate = () => {
    const csv = Papa.unparse([{
      descripcion: 'Venta Cliente X',
      cantidad: 1500.00,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      categoria: categories[0]?.name || 'Ventas',
      estado: 'Previsto'
    }]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'plantilla_facturas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredInvoices = invoices.filter(inv => filter === 'all' || inv.status === filter).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Facturación y Previsiones</h2>
          <p className="text-zinc-500">Registra tus cobros y pagos específicos para el cálculo de caja.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="button-secondary flex items-center gap-2 cursor-pointer">
            <Download className="w-4 h-4" /> Importar CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
          </label>
          <button onClick={downloadTemplate} className="button-secondary flex items-center gap-2">
             <FileJson className="w-4 h-4" /> Plantilla
          </button>
          <button onClick={() => setIsAdding(!isAdding)} className="button-primary flex items-center gap-2">
            {isAdding ? 'Cerrar' : <><Plus className="w-4 h-4" /> Nueva Factura</>}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <form onSubmit={handleAdd} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Categoría</label>
                  <select className="input-standard" value={newInv.categoryId} onChange={e => setNewInv({...newInv, categoryId: e.target.value})}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-1">
                   <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Descripción</label>
                   <input className="input-standard" placeholder="Referencia o concepto..." value={newInv.description} onChange={e => setNewInv({...newInv, description: e.target.value})} />
                </div>
                <div>
                   <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Importe (€)</label>
                   <input type="number" step="0.01" className="input-standard text-right" value={newInv.amount} onChange={e => setNewInv({...newInv, amount: Number(e.target.value)})} />
                </div>
                <div>
                   <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Fecha</label>
                   <input type="date" className="input-standard" value={newInv.date} onChange={e => setNewInv({...newInv, date: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button type="submit" className="button-primary">Guardar Registro</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex bg-white rounded-lg p-1 border border-zinc-200">
            <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Todas</FilterBtn>
            <FilterBtn active={filter === 'predicted'} onClick={() => setFilter('predicted')}>Previstas</FilterBtn>
            <FilterBtn active={filter === 'paid'} onClick={() => setFilter('paid')}>Pagadas</FilterBtn>
          </div>
          <div className="text-xs font-mono text-zinc-400">TOTAL {filteredInvoices.length} REGISTROS</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-100 text-xs font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50/30">
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Categoría / Concepto</th>
                <th className="px-6 py-4 text-right">Importe</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredInvoices.map(inv => {
                const cat = categories.find(c => c.id === inv.categoryId);
                return (
                  <tr key={inv.id} className="hover:bg-zinc-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <button onClick={() => toggleStatus(inv.id, inv.status)} className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-all ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-500'}`}>
                        {inv.status === 'paid' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {inv.status === 'paid' ? 'Pagado' : 'Previsto'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-zinc-500">
                      {format(parseISO(inv.date), 'dd MMM yyyy', { locale: es })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm">{inv.description || 'Sin descripción'}</div>
                      <div className="text-[10px] uppercase text-zinc-400 font-mono tracking-tighter">{cat?.name}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold">
                       {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(inv.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button onClick={() => handleDelete(inv.id)} className="text-zinc-200 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredInvoices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Search className="w-12 h-12 mb-4 opacity-10" />
              <p>No se han encontrado registros facturados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterBtn({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${active ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-500 hover:text-zinc-900'}`}
    >
      {children}
    </button>
  );
}
