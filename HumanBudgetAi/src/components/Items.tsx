import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { BudgetCategory, BudgetItem } from '../types';
import { Plus, Trash2, User, FileText, Calendar, TrendingUp, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Items() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemValue, setNewItemValue] = useState<any>(0);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Salary Update Preview State
  const [updateForm, setUpdateForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'percent' as 'amount' | 'percent',
    value: 0
  });

  useEffect(() => {
    if (!user) return;
    const qCat = query(collection(db, 'budgetCategories'), where('userId', '==', user.uid));
    const qItems = query(collection(db, 'budgetItems'), where('userId', '==', user.uid));
    
    const unsubCat = onSnapshot(qCat, 
      (s) => {
        const cats = s.docs.map(d => ({ id: d.id, ...d.data() } as BudgetCategory));
        setCategories(cats);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'budgetCategories')
    );
    const unsubItems = onSnapshot(qItems, 
      (s) => setItems(s.docs.map(d => ({ id: d.id, ...d.data() } as BudgetItem))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'budgetItems')
    );

    return () => {
      unsubCat();
      unsubItems();
    };
  }, [user]);

  // Handle initial selection
  useEffect(() => {
    if (categories.length > 0 && !selectedCatId) {
      setSelectedCatId(categories[0].id);
    }
  }, [categories, selectedCatId]);

  const selectedCat = categories.find(c => c.id === selectedCatId);
  const catItems = items.filter(i => i.categoryId === selectedCatId);

  const handleAddItem = async () => {
    if (!user || !selectedCatId || !newItemName) return;

    let values: any = {};
    if (selectedCat?.logicType === 'staff') values = { salary: newItemValue };
    else if (selectedCat?.logicType === 'fixed') values = { amount: newItemValue };
    else if (selectedCat?.logicType === 'variable') values = { monthly: {} };
    
    try {
      await addDoc(collection(db, 'budgetItems'), {
        categoryId: selectedCatId,
        name: newItemName,
        values,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'budgetItems');
    }

    setNewItemName('');
    setNewItemValue(0);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'budgetItems', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `budgetItems/${id}`);
    }
  };

  const updateItemValue = async (id: string, field: string, val: any) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    try {
      await updateDoc(doc(db, 'budgetItems', id), {
        values: { ...item.values, [field]: val }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `budgetItems/${id}`);
    }
  };

  const handleAddSalaryUpdate = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const updates = [...(item.values.salaryUpdates || []), { ...updateForm }];
    try {
      await updateDoc(doc(db, 'budgetItems', itemId), {
        'values.salaryUpdates': updates
      });
      setUpdateForm({ ...updateForm, value: 0 });
      // Minor feedback: we could add a temporary state for success but resetting value is usually enough
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `budgetItems/${itemId}`);
    }
  };

  const calculatePreview = (baseSalary: number) => {
    let result = baseSalary;
    if (updateForm.type === 'amount') result += updateForm.value;
    else result *= (1 + updateForm.value / 100);
    return result;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* Sidebar: Category Selection */}
      <div className="lg:col-span-1 space-y-4">
        <h2 className="text-xl font-bold tracking-tight px-2">Categorías</h2>
        <div className="space-y-1">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${selectedCatId === cat.id ? 'bg-zinc-900 text-white shadow-md' : 'hover:bg-white text-zinc-600'}`}
            >
              <span className="font-medium">{cat.name}</span>
              {selectedCatId === cat.id && <div className="w-1.5 h-1.5 bg-sky-400 rounded-full" />}
            </button>
          ))}
          {categories.length === 0 && <p className="text-sm text-zinc-400 px-4 italic">No hay categorías configuradas.</p>}
        </div>
      </div>

      {/* Main Content: Items in Selected Category */}
      <div className="lg:col-span-3 space-y-8 animate-in slide-in-from-right-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{selectedCat?.name || 'Selecciona una categoría'}</h2>
            <p className="text-zinc-500">
              {selectedCat?.logicType === 'staff' ? 'Gestiona el personal y sus remuneraciones.' : 
               selectedCat?.logicType === 'fixed' ? 'Pagos fijos mensuales.' : 'Detalles de la categoría.'}
            </p>
          </div>
        </div>

        {selectedCat && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
             <div className="p-4 bg-zinc-50/50 border-bottom border-zinc-200 grid grid-cols-12 gap-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <div className="col-span-6">Concepto</div>
                <div className="col-span-4 text-right">Cantidad Base (€)</div>
                <div className="col-span-2"></div>
             </div>
             
             <div className="divide-y divide-zinc-100">
                {catItems.map(item => (
                  <React.Fragment key={item.id}>
                    <div className="p-4 grid grid-cols-12 gap-4 items-center hover:bg-zinc-50/30 transition-colors group">
                      <div className="col-span-6 flex items-center gap-3">
                        <div className="p-2 bg-zinc-100 rounded-lg">
                          {selectedCat.logicType === 'staff' ? <User className="w-4 h-4 text-zinc-500" /> : <FileText className="w-4 h-4 text-zinc-500" />}
                        </div>
                        <div>
                          <span className="font-medium block">{item.name}</span>
                          {selectedCat.logicType === 'staff' && (
                            <button 
                              onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                              className="text-[10px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1 hover:text-sky-700"
                            >
                              {expandedItemId === item.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              Actualización salarial {(item.values.salaryUpdates?.length || 0) > 0 && `(${item.values.salaryUpdates.length})`}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="col-span-4 flex justify-end items-center gap-3">
                        <div className="text-right">
                          <input 
                            type="number"
                            className="bg-transparent text-right font-mono border-b border-transparent focus:border-zinc-400 outline-hidden w-24 p-1"
                            value={selectedCat.logicType === 'staff' ? (item.values?.salary || 0) : (item.values?.amount || 0)}
                            onChange={(e) => updateItemValue(item.id, selectedCat.logicType === 'staff' ? 'salary' : 'amount', Number(e.target.value))}
                          />
                          <span className="text-[10px] text-zinc-400 block">Base mensual</span>
                        </div>
                      </div>
                      <div className="col-span-2 flex justify-end gap-2">
                         <button onClick={() => handleDelete(item.id)} className="text-zinc-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    </div>

                    {/* Salary Updates Expansion */}
                    <AnimatePresence>
                      {expandedItemId === item.id && selectedCat.logicType === 'staff' && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden bg-zinc-50 border-y border-zinc-100"
                        >
                          <div className="p-6 space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-sky-600" />
                              <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-600">Planificar Aumento</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                              <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Fecha Efectiva</label>
                                <input 
                                  type="date"
                                  className="w-full text-xs p-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-hidden"
                                  value={updateForm.date}
                                  onChange={e => setUpdateForm({...updateForm, date: e.target.value})}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Tipo de aumento</label>
                                <select 
                                  className="w-full text-xs p-2 border border-zinc-200 rounded-lg outline-hidden"
                                  value={updateForm.type}
                                  onChange={e => setUpdateForm({...updateForm, type: e.target.value as 'amount' | 'percent'})}
                                >
                                  <option value="percent">Porcentaje (%)</option>
                                  <option value="amount">Importe Fijo (€)</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Valor</label>
                                <input 
                                  type="number"
                                  className="w-full text-xs p-2 border border-zinc-200 rounded-lg outline-hidden"
                                  value={updateForm.value}
                                  onChange={e => setUpdateForm({...updateForm, value: Number(e.target.value)})}
                                />
                              </div>
                              <div className="flex items-end">
                                <button 
                                  onClick={() => handleAddSalaryUpdate(item.id)}
                                  className="w-full bg-zinc-900 text-white text-xs font-bold py-2 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar Aumento
                                </button>
                              </div>
                            </div>

                            {/* Precálculo */}
                            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <span className="text-[10px] text-sky-600 font-bold uppercase block">Salario Actual</span>
                                  <span className="font-mono font-bold">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.values.salary)}</span>
                                </div>
                                <div className="text-zinc-400">→</div>
                                <div className="text-center">
                                  <span className="text-[10px] text-sky-600 font-bold uppercase block">Nuevo Salario</span>
                                  <span className="font-mono font-bold text-sky-700">{new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(calculatePreview(item.values.salary))}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-sky-600 font-bold uppercase block">Impacto Total (con Seg. Soc.)</span>
                                <span className="font-mono font-bold text-xl">
                                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(calculatePreview(item.values.salary) * (1 + (selectedCat.config?.ssPercentage || 0.3)))}
                                </span>
                              </div>
                            </div>

                            {/* Historial de actualizaciones */}
                            {item.values.salaryUpdates?.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Actualizaciones Programadas</span>
                                {item.values.salaryUpdates.map((upd: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between bg-white px-4 py-2 rounded-lg border border-zinc-100 text-xs">
                                    <div className="flex items-center gap-4">
                                      <Calendar className="w-3 h-3 text-zinc-400" />
                                      <span className="font-medium">{new Date(upd.date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                                      <span className="text-zinc-400">|</span>
                                      <span className="font-bold text-emerald-600">+{upd.value}{upd.type === 'percent' ? '%' : '€'}</span>
                                    </div>
                                    <button 
                                      onClick={async () => {
                                        const newUpdates = item.values.salaryUpdates.filter((_: any, i: number) => i !== idx);
                                        await updateDoc(doc(db, 'budgetItems', item.id), { 'values.salaryUpdates': newUpdates });
                                      }}
                                      className="text-zinc-300 hover:text-rose-500"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}

                {/* Add New Line */}
                <div className="p-4 grid grid-cols-12 gap-4 items-center bg-zinc-50/20">
                  <div className="col-span-6">
                    <input 
                      className="w-full bg-transparent border-b border-zinc-200 focus:border-zinc-900 outline-hidden p-1 placeholder:text-zinc-300"
                      placeholder={selectedCat.logicType === 'staff' ? 'Nombre del empleado...' : 'Descripción del concepto...'}
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                    />
                  </div>
                  <div className="col-span-4 flex justify-end">
                    <input 
                      type="number"
                      className="bg-transparent text-right border-b border-zinc-200 focus:border-zinc-900 outline-hidden w-24 p-1"
                      placeholder="0.00"
                      value={newItemValue}
                      onChange={e => setNewItemValue(Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button 
                      onClick={handleAddItem}
                      disabled={!newItemName}
                      className="p-1 text-emerald-500 hover:scale-125 transition-all disabled:opacity-30"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
