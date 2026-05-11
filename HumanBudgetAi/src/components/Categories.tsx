import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { BudgetCategory, LogicType, EntryType } from '../types';
import { Plus, Trash2, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AIHelper from './AIHelper';

const LOGIC_DESCRIPTIONS: Record<LogicType, string> = {
  staff: 'Sueldos + Seguridad Social. Configurar % de SS.',
  fixed: 'Cantidades fijas que se repiten cada mes.',
  variable: 'Cantidades que pueden variar mes a mes pero son regulares.',
  invoiced: 'Basado en facturas específicas previstas (ingresos o gastos).'
};

interface EditingState {
  id: string;
  name: string;
  type: EntryType;
  logicType: LogicType;
  ssPercentage: number;
}

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingCat, setEditingCat] = useState<EditingState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState({
    name: '',
    type: 'expense' as EntryType,
    logicType: 'fixed' as LogicType,
    ssPercentage: 0.3
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'budgetCategories'), where('userId', '==', user.uid));
    return onSnapshot(q, 
      (s) => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() } as BudgetCategory))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'budgetCategories')
    );
  }, [user]);

  const handleAdd = async (e?: React.FormEvent, directData?: any) => {
    if (e) e.preventDefault();
    const data = directData || {
      name: newCat.name,
      type: newCat.type,
      logicType: newCat.logicType,
      config: newCat.logicType === 'staff' ? { ssPercentage: newCat.ssPercentage } : {}
    };

    if (!user || !data.name) return;

    try {
      await addDoc(collection(db, 'budgetCategories'), {
        ...data,
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'budgetCategories');
    }

    setIsAdding(false);
    setNewCat({ name: '', type: 'expense', logicType: 'fixed', ssPercentage: 0.3 });
  };

  const handleUpdate = async (e?: React.FormEvent, directData?: any) => {
    if (e) e.preventDefault();
    if (!editingCat && !directData) return;
    
    const id = directData?.id || editingCat?.id;
    const data = directData || {
      name: editingCat!.name,
      type: editingCat!.type,
      logicType: editingCat!.logicType,
      config: editingCat!.logicType === 'staff' ? { ssPercentage: editingCat!.ssPercentage } : {}
    };

    try {
      await updateDoc(doc(db, 'budgetCategories', id), {
        name: data.name,
        type: data.type,
        logicType: data.logicType,
        config: data.config
      });
      setEditingCat(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `budgetCategories/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'budgetCategories', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `budgetCategories/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Estructura del Presupuesto</h2>
          <p className="text-zinc-500">Configura los "cubos" lógicos donde distribuirás tu dinero.</p>
        </div>
        <div className="flex items-center gap-3">
          <AIHelper onSuccess={(data) => {
            setNewCat({
              name: data.name,
              type: data.type,
              logicType: data.logicType as LogicType,
              ssPercentage: data.config?.ssPercentage || 0.3
            });
            setIsAdding(true);
          }} />
          <button 
            onClick={() => {
              setIsAdding(!isAdding);
              setEditingCat(null);
            }}
            className="button-primary flex items-center gap-2"
          >
            {isAdding ? 'Cancelar' : <><Plus className="w-4 h-4" /> Nueva Categoría</>}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {(isAdding || editingCat) && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form 
              onSubmit={editingCat ? (e) => handleUpdate(e) : handleAdd} 
              className="bg-white p-6 rounded-2xl border-2 border-zinc-900 shadow-xl space-y-4 mb-8"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">{editingCat ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                {editingCat && (
                   <AIHelper 
                    context={`Nombre: ${editingCat.name}, Tipo: ${editingCat.type}, Lógica: ${editingCat.logicType}. `}
                    onSuccess={(data) => setEditingCat({
                      ...editingCat,
                      name: data.name,
                      type: data.type,
                      logicType: data.logicType as LogicType,
                      ssPercentage: data.config?.ssPercentage || 0.3
                    })} 
                   />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Nombre</label>
                  <input 
                    className="input-standard" 
                    placeholder="Ej. Personal Oficina"
                    value={editingCat ? editingCat.name : newCat.name}
                    onChange={e => editingCat ? setEditingCat({...editingCat, name: e.target.value}) : setNewCat({...newCat, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Tipo</label>
                  <select 
                    className="input-standard"
                    value={editingCat ? editingCat.type : newCat.type}
                    onChange={e => editingCat ? setEditingCat({...editingCat, type: e.target.value as EntryType}) : setNewCat({...newCat, type: e.target.value as EntryType})}
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Lógica</label>
                  <select 
                    className="input-standard"
                    value={editingCat ? editingCat.logicType : newCat.logicType}
                    onChange={e => editingCat ? setEditingCat({...editingCat, logicType: e.target.value as LogicType}) : setNewCat({...newCat, logicType: e.target.value as LogicType})}
                  >
                    <option value="fixed">Fijo mensual</option>
                    <option value="staff">Personal (Sueldo + SS)</option>
                    <option value="variable">Variable / Manual</option>
                    <option value="invoiced">Previsión facturas</option>
                  </select>
                </div>
                {(editingCat ? editingCat.logicType === 'staff' : newCat.logicType === 'staff') && (
                  <div>
                    <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">% Seg. Social</label>
                    <input 
                      type="number" step="0.01" 
                      className="input-standard"
                      value={editingCat ? editingCat.ssPercentage : newCat.ssPercentage}
                      onChange={e => editingCat ? setEditingCat({...editingCat, ssPercentage: Number(e.target.value)}) : setNewCat({...newCat, ssPercentage: Number(e.target.value)})}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => editingCat ? setEditingCat(null) : setIsAdding(false)} className="button-secondary">Cancelar</button>
                <button type="submit" className="button-primary">{editingCat ? 'Actualizar' : 'Guardar'} Categoría</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {categories.map(cat => (
          <motion.div 
            layout
            key={cat.id}
            className={`p-6 rounded-2xl border-2 bg-white shadow-xs card-hover flex flex-col justify-between group ${cat.type === 'income' ? 'border-emerald-100 hover:border-emerald-300' : 'border-zinc-100 hover:border-zinc-300'}`}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cat.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-50 text-zinc-500'}`}>
                  {cat.type === 'income' ? 'Ingreso' : 'Gasto'}
                </div>
                <div className="flex gap-1 items-center">
                  {deletingId === cat.id ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 bg-rose-50 p-1 rounded-lg border border-rose-100"
                    >
                      <span className="text-[10px] font-bold text-rose-600 px-1">¿Borrar?</span>
                      <button 
                        onClick={() => handleDelete(cat.id)}
                        className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-md font-bold hover:bg-rose-600 transition-colors"
                      >
                        Sí
                      </button>
                      <button 
                        onClick={() => setDeletingId(null)}
                        className="text-[10px] bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-md font-bold hover:bg-zinc-300 transition-colors"
                      >
                        No
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <button 
                        onClick={() => setEditingCat({ id: cat.id, name: cat.name, type: cat.type, logicType: cat.logicType, ssPercentage: cat.config?.ssPercentage || 0.3 })} 
                        className="text-zinc-300 hover:text-zinc-600 transition-colors p-1"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeletingId(cat.id)} className="text-zinc-300 hover:text-rose-500 transition-colors p-1 opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <h3 className="text-lg font-bold mb-1">{cat.name}</h3>
              <div className="flex items-center gap-2 text-zinc-500 text-sm mb-4">
                <Settings className="w-3.5 h-3.5" />
                <span>{LOGIC_DESCRIPTIONS[cat.logicType]}</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
              <span className="text-xs font-mono text-zinc-400 uppercase">{cat.logicType}</span>
              {cat.logicType === 'staff' && (
                <span className="text-xs font-semibold bg-zinc-100 px-2 py-1 rounded-lg">SS: {((cat.config.ssPercentage || 0) * 100).toFixed(0)}%</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
