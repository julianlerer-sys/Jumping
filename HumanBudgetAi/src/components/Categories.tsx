import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { BudgetCategory, LogicType, EntryType } from '../types';
import { Plus, Trash2, Settings, ChevronDown, ChevronUp, Code2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AIHelper from './AIHelper';

const LOGIC_LABELS: Record<LogicType, string> = {
  staff: 'Personal (Sueldo + SS)',
  fixed: 'Fijo mensual',
  variable: 'Variable / Manual',
  invoiced: 'Previsión facturas',
  artistic: 'Personal Artístico (IRPF)',
  custom: 'Lógica personalizada IA'
};

const LOGIC_DESCRIPTIONS: Record<LogicType, string> = {
  staff: 'Sueldos + Seguridad Social. Configurar % de SS.',
  fixed: 'Cantidades fijas que se repiten cada mes.',
  variable: 'Cantidades que pueden variar mes a mes pero son regulares.',
  invoiced: 'Basado en facturas específicas previstas (ingresos o gastos).',
  artistic: 'Honorarios manuales mes a mes + retención IRPF Profesionales trimestral.',
  custom: 'Lógica generada por IA con cálculos personalizados.'
};

interface CategoryForm {
  name: string;
  type: EntryType;
  logicType: LogicType;
  config: any;
}

interface EditingState extends CategoryForm {
  id: string;
}

const defaultForm: CategoryForm = {
  name: '',
  type: 'expense',
  logicType: 'fixed',
  config: {}
};

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingCat, setEditingCat] = useState<EditingState | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedFnId, setExpandedFnId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState<CategoryForm>(defaultForm);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'budgetCategories'), where('userId', '==', user.uid));
    return onSnapshot(q,
      (s) => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() } as BudgetCategory))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'budgetCategories')
    );
  }, [user]);

  const buildConfig = (form: CategoryForm) => {
    if (form.logicType === 'staff') return { ssPercentage: form.config?.ssPercentage ?? 0.3 };
    if (form.logicType === 'artistic') return { ivaRate: form.config?.ivaRate ?? 0.21, irpfRate: form.config?.irpfRate ?? 0.15 };
    if (form.logicType === 'custom') return form.config;
    return {};
  };

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !newCat.name) return;
    try {
      await addDoc(collection(db, 'budgetCategories'), {
        name: newCat.name,
        type: newCat.type,
        logicType: newCat.logicType,
        config: buildConfig(newCat),
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'budgetCategories');
    }
    setIsAdding(false);
    setNewCat(defaultForm);
  };

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingCat) return;
    try {
      await updateDoc(doc(db, 'budgetCategories', editingCat.id), {
        name: editingCat.name,
        type: editingCat.type,
        logicType: editingCat.logicType,
        config: buildConfig(editingCat)
      });
      setEditingCat(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `budgetCategories/${editingCat.id}`);
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

  const applyAIData = (data: any, isEditing: boolean) => {
    const form: CategoryForm = {
      name: data.name,
      type: data.type,
      logicType: data.logicType as LogicType,
      config: data.config || {}
    };
    if (isEditing && editingCat) {
      setEditingCat({ ...editingCat, ...form });
    } else {
      setNewCat(form);
      setIsAdding(true);
    }
  };

  const activeForm = editingCat || newCat;
  const setActiveForm = (vals: Partial<CategoryForm>) => {
    if (editingCat) setEditingCat({ ...editingCat, ...vals });
    else setNewCat(prev => ({ ...prev, ...vals }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Estructura del Presupuesto</h2>
          <p className="text-zinc-500">Configura los "cubos" lógicos donde distribuirás tu dinero.</p>
        </div>
        <div className="flex items-center gap-3">
          <AIHelper onSuccess={(data) => applyAIData(data, false)} />
          <button
            onClick={() => { setIsAdding(!isAdding); setEditingCat(null); }}
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
              onSubmit={editingCat ? handleUpdate : handleAdd}
              className="bg-white p-6 rounded-2xl border-2 border-zinc-900 shadow-xl space-y-4 mb-8"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg">{editingCat ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                {editingCat && (
                  <AIHelper
                    context={`Nombre: ${editingCat.name}, Tipo: ${editingCat.type}, Lógica: ${editingCat.logicType}.`}
                    onSuccess={(data) => applyAIData(data, true)}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Nombre</label>
                  <input
                    className="input-standard"
                    placeholder="Ej. Personal Oficina"
                    value={activeForm.name}
                    onChange={e => setActiveForm({ name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Tipo</label>
                  <select
                    className="input-standard"
                    value={activeForm.type}
                    onChange={e => setActiveForm({ type: e.target.value as EntryType })}
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">Lógica</label>
                  <select
                    className="input-standard"
                    value={activeForm.logicType}
                    onChange={e => setActiveForm({ logicType: e.target.value as LogicType })}
                  >
                    <option value="fixed">Fijo mensual</option>
                    <option value="staff">Personal (Sueldo + SS)</option>
                    <option value="variable">Variable / Manual</option>
                    <option value="invoiced">Previsión facturas</option>
                    <option value="artistic">Personal Artístico (IRPF)</option>
                    <option value="custom">Lógica personalizada IA</option>
                  </select>
                </div>
                {activeForm.logicType === 'staff' && (
                  <div>
                    <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">% Seg. Social</label>
                    <input
                      type="number" step="0.01"
                      className="input-standard"
                      value={activeForm.config?.ssPercentage ?? 0.3}
                      onChange={e => setActiveForm({ config: { ...activeForm.config, ssPercentage: Number(e.target.value) } })}
                    />
                  </div>
                )}
                {activeForm.logicType === 'artistic' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">% IVA</label>
                      <input
                        type="number" step="0.01"
                        className="input-standard"
                        value={activeForm.config?.ivaRate ?? 0.21}
                        onChange={e => setActiveForm({ config: { ...activeForm.config, ivaRate: Number(e.target.value) } })}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase text-zinc-400 mb-1 block">% IRPF Retención</label>
                      <input
                        type="number" step="0.01"
                        className="input-standard"
                        value={activeForm.config?.irpfRate ?? 0.15}
                        onChange={e => setActiveForm({ config: { ...activeForm.config, irpfRate: Number(e.target.value) } })}
                      />
                    </div>
                  </>
                )}
              </div>

              {activeForm.logicType === 'custom' && activeForm.config?.description && (
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 text-sm text-sky-800">
                  <span className="font-bold block mb-1 text-xs uppercase text-sky-500">Lógica generada por IA</span>
                  {activeForm.config.description}
                </div>
              )}

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
                      <button onClick={() => handleDelete(cat.id)} className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-md font-bold hover:bg-rose-600 transition-colors">Sí</button>
                      <button onClick={() => setDeletingId(null)} className="text-[10px] bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-md font-bold hover:bg-zinc-300 transition-colors">No</button>
                    </motion.div>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingCat({ id: cat.id, name: cat.name, type: cat.type, logicType: cat.logicType, config: cat.config || {} })}
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
              <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span>{cat.logicType === 'custom' && cat.config?.description ? cat.config.description : LOGIC_DESCRIPTIONS[cat.logicType]}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
              <span className="text-xs font-mono text-zinc-400 uppercase">{cat.logicType}</span>
              <div className="flex items-center gap-2">
                {cat.logicType === 'staff' && (
                  <span className="text-xs font-semibold bg-zinc-100 px-2 py-1 rounded-lg">SS: {((cat.config?.ssPercentage || 0) * 100).toFixed(0)}%</span>
                )}
                {cat.logicType === 'artistic' && (
                  <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
                    IVA {((cat.config?.ivaRate || 0.21) * 100).toFixed(0)}% · IRPF {((cat.config?.irpfRate || 0.15) * 100).toFixed(0)}%
                  </span>
                )}
                {cat.logicType === 'custom' && cat.config?.customFunction && (
                  <button
                    onClick={() => setExpandedFnId(expandedFnId === cat.id ? null : cat.id)}
                    className="flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-1 rounded-lg hover:bg-violet-100 transition-colors"
                  >
                    <Code2 className="w-3 h-3" />
                    {expandedFnId === cat.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {expandedFnId === cat.id && cat.config?.customFunction && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <pre className="mt-3 p-3 bg-zinc-900 text-zinc-100 rounded-xl text-[10px] overflow-x-auto font-mono leading-relaxed">
                    {cat.config.customFunction}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
