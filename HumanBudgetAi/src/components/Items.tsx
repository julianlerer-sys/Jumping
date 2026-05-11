import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { BudgetCategory, BudgetItem, CustomField, UserSettings } from '../types';
import { Plus, Trash2, User, FileText, Calendar, TrendingUp, ChevronDown, ChevronUp, CheckCircle2, Zap, Gift, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function Items() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemValue, setNewItemValue] = useState<any>(0);
  const [newItemCustomValues, setNewItemCustomValues] = useState<Record<string, any>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [fiscalStartMonth, setFiscalStartMonth] = useState<number>(0);

  const [updateForm, setUpdateForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'percent' as 'amount' | 'percent',
    value: 0
  });

  const [bonusForm, setBonusForm] = useState({
    date: new Date().toISOString().split('T')[0],
    concept: '',
    amount: 0
  });

  useEffect(() => {
    if (!user) return;
    const qCat = query(collection(db, 'budgetCategories'), where('userId', '==', user.uid));
    const qItems = query(collection(db, 'budgetItems'), where('userId', '==', user.uid));

    const qSettings = query(collection(db, 'settings'), where('userId', '==', user.uid));
    const unsubSettings = onSnapshot(qSettings, (s) => {
      if (!s.empty) {
        const data = s.docs[0].data() as UserSettings;
        setFiscalStartMonth(data.fiscalYearStartMonth ?? 0);
      }
    });

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

    return () => { unsubCat(); unsubItems(); unsubSettings(); };
  }, [user]);

  useEffect(() => {
    if (categories.length > 0 && !selectedCatId) {
      setSelectedCatId(categories[0].id);
    }
  }, [categories, selectedCatId]);

  const selectedCat = categories.find(c => c.id === selectedCatId);
  const catItems = items.filter(i => i.categoryId === selectedCatId);
  const customFields: CustomField[] = selectedCat?.config?.customFields || [];
  const fiscalMonths = Array.from({ length: 12 }, (_, i) => (fiscalStartMonth + i) % 12);

  const buildInitialValues = () => {
    if (selectedCat?.logicType === 'staff') return { salary: newItemValue };
    if (selectedCat?.logicType === 'fixed') return { amount: newItemValue };
    if (selectedCat?.logicType === 'variable') return { monthly: {} };
    if (selectedCat?.logicType === 'artistic') return { monthly: {} };
    if (selectedCat?.logicType === 'custom') {
      const vals: Record<string, any> = {};
      customFields.forEach(f => { vals[f.key] = newItemCustomValues[f.key] ?? f.defaultValue ?? 0; });
      return vals;
    }
    return {};
  };

  const handleAddItem = async () => {
    if (!user || !selectedCatId || !newItemName) return;
    try {
      await addDoc(collection(db, 'budgetItems'), {
        categoryId: selectedCatId,
        name: newItemName,
        values: buildInitialValues(),
        userId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'budgetItems');
    }
    setNewItemName('');
    setNewItemValue(0);
    setNewItemCustomValues({});
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
      await updateDoc(doc(db, 'budgetItems', itemId), { 'values.salaryUpdates': updates });
      setUpdateForm({ ...updateForm, value: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `budgetItems/${itemId}`);
    }
  };

  const updateMonthlyValue = async (itemId: string, monthIndex: number, val: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const monthly = { ...(item.values?.monthly || {}), [monthIndex]: val };
    try {
      await updateDoc(doc(db, 'budgetItems', itemId), { 'values.monthly': monthly });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `budgetItems/${itemId}`);
    }
  };

  const handleAddBonus = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item || !bonusForm.amount) return;
    const bonuses = [...(item.values.bonuses || []), { ...bonusForm }];
    try {
      await updateDoc(doc(db, 'budgetItems', itemId), { 'values.bonuses': bonuses });
      setBonusForm({ ...bonusForm, concept: '', amount: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `budgetItems/${itemId}`);
    }
  };

  const calculatePreview = (baseSalary: number) => {
    if (updateForm.type === 'amount') return baseSalary + updateForm.value;
    return baseSalary * (1 + updateForm.value / 100);
  };

  const getItemDescription = () => {
    if (!selectedCat) return '';
    if (selectedCat.logicType === 'staff') return 'Gestiona el personal y sus remuneraciones.';
    if (selectedCat.logicType === 'fixed') return 'Pagos fijos mensuales.';
    if (selectedCat.logicType === 'custom') return selectedCat.config?.description || 'Categoría con lógica personalizada.';
    return 'Detalles de la categoría.';
  };

  const showItemsTable = selectedCat?.logicType !== 'invoiced' &&
    !(selectedCat?.logicType === 'custom' && customFields.length === 0) &&
    selectedCat?.logicType !== 'artistic';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
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
              <div className="flex items-center gap-2">
                {cat.logicType === 'custom' && <Zap className="w-3 h-3 text-violet-400" />}
                {selectedCatId === cat.id && <div className="w-1.5 h-1.5 bg-sky-400 rounded-full" />}
              </div>
            </button>
          ))}
          {categories.length === 0 && <p className="text-sm text-zinc-400 px-4 italic">No hay categorías configuradas.</p>}
        </div>
      </div>

      <div className="lg:col-span-3 space-y-8 animate-in slide-in-from-right-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{selectedCat?.name || 'Selecciona una categoría'}</h2>
              {selectedCat?.logicType === 'custom' && (
                <span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full uppercase">IA</span>
              )}
            </div>
            <p className="text-zinc-500">{getItemDescription()}</p>
          </div>
        </div>

        {selectedCat?.logicType === 'invoiced' && (
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6 text-sm text-sky-700">
            Esta categoría usa facturas. Gestiona las facturas en la pestaña <strong>Facturas</strong>.
          </div>
        )}

        {selectedCat?.logicType === 'custom' && customFields.length === 0 && (
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-6 text-sm text-violet-700">
            Esta categoría calcula a partir de facturas. Gestiona las facturas en la pestaña <strong>Facturas</strong>.
          </div>
        )}

        {selectedCat?.logicType === 'artistic' && (
          <div className="space-y-4">
            {/* Add new artist */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-4 flex gap-3 items-center">
              <input
                className="flex-1 bg-transparent border-b border-zinc-200 focus:border-zinc-900 outline-hidden p-1 placeholder:text-zinc-300"
                placeholder="Nombre del artista / profesional..."
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
              />
              <button
                onClick={handleAddItem}
                disabled={!newItemName}
                className="p-1 text-emerald-500 hover:scale-125 transition-all disabled:opacity-30"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {catItems.map(item => {
              const monthly = item.values?.monthly || {};
              const totalBase = (Object.values(monthly) as number[]).reduce((s, v) => s + Number(v), 0);
              const irpfRate = selectedCat.config?.irpfRate || 0.15;
              const ivaRate = selectedCat.config?.ivaRate || 0.21;
              const totalIva = totalBase * ivaRate;
              const totalIrpf = totalBase * irpfRate;
              const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
              const isExpanded = expandedItemId === item.id;

              return (
                <div key={item.id} className="bg-white rounded-2xl border border-amber-100 shadow-xs overflow-hidden">
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-50 rounded-lg">
                        <Music className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <span className="font-medium block">{item.name}</span>
                        <span className="text-[10px] text-zinc-400 flex gap-2 flex-wrap">
                          <span>Base: <strong>{fmt(totalBase)}</strong></span>
                          <span className="text-emerald-600">+IVA {fmt(totalIva)}</span>
                          <span className="text-rose-500">−IRPF {fmt(totalIrpf)}</span>
                          <span>→ Neto artista: <strong>{fmt(totalBase + totalIva - totalIrpf)}</strong></span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className="text-[10px] font-bold text-amber-600 flex items-center gap-1 hover:text-amber-700"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        Honorarios por mes
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="text-zinc-300 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-amber-50"
                      >
                        <div className="p-4 grid grid-cols-6 md:grid-cols-12 gap-2">
                          {fiscalMonths.map((calMonth) => (
                            <div key={calMonth} className="text-center">
                              <label className="text-[9px] font-bold text-zinc-400 uppercase block mb-1">{MONTH_NAMES[calMonth]}</label>
                              <input
                                type="number"
                                className="w-full text-xs text-center border border-zinc-200 rounded-lg p-1.5 focus:ring-2 focus:ring-amber-400 outline-hidden"
                                value={monthly[calMonth] || ''}
                                placeholder="0"
                                onChange={e => updateMonthlyValue(item.id, calMonth, Number(e.target.value))}
                              />
                            </div>
                          ))}
                        </div>
                        <div className="px-4 pb-4 grid grid-cols-3 gap-2 text-[10px]">
                          <div className="bg-zinc-50 rounded-lg p-2 text-center">
                            <span className="text-zinc-400 block">Factura (base + IVA {(ivaRate*100).toFixed(0)}%)</span>
                            <span className="font-bold text-zinc-700">Aparece en el presupuesto mensual</span>
                          </div>
                          <div className="bg-rose-50 rounded-lg p-2 text-center">
                            <span className="text-rose-400 block">IRPF {(irpfRate*100).toFixed(0)}% (sobre base)</span>
                            <span className="font-bold text-rose-700">Retenido, NO se paga al artista</span>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-2 text-center">
                            <span className="text-amber-500 block">Provisión trimestral</span>
                            <span className="font-bold text-amber-700">Pago a Hacienda el día 20 tras cada trimestre</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {selectedCat && showItemsTable && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-zinc-50/50 border-b border-zinc-200 grid gap-4 text-xs font-bold uppercase tracking-wider text-zinc-400"
              style={{ gridTemplateColumns: selectedCat.logicType === 'custom' ? `repeat(${customFields.length + 2}, 1fr)` : '6fr 4fr 2fr' }}
            >
              <div className="col-span-1">Concepto</div>
              {selectedCat.logicType === 'custom'
                ? customFields.map(f => <div key={f.key} className="text-right">{f.label}</div>)
                : <div className="text-right">Cantidad Base (€)</div>
              }
              <div></div>
            </div>

            <div className="divide-y divide-zinc-100">
              {catItems.map(item => (
                <React.Fragment key={item.id}>
                  <div className="p-4 grid gap-4 items-center hover:bg-zinc-50/30 transition-colors group"
                    style={{ gridTemplateColumns: selectedCat.logicType === 'custom' ? `repeat(${customFields.length + 2}, 1fr)` : '6fr 4fr 2fr' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-100 rounded-lg shrink-0">
                        {selectedCat.logicType === 'staff' ? <User className="w-4 h-4 text-zinc-500" /> : selectedCat.logicType === 'custom' ? <Zap className="w-4 h-4 text-violet-500" /> : <FileText className="w-4 h-4 text-zinc-500" />}
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

                    {selectedCat.logicType === 'custom'
                      ? customFields.map(f => (
                        <div key={f.key} className="flex justify-end">
                          <input
                            type="number"
                            className="bg-transparent text-right font-mono border-b border-transparent focus:border-zinc-400 outline-hidden w-24 p-1"
                            value={item.values?.[f.key] ?? f.defaultValue ?? 0}
                            onChange={e => updateItemValue(item.id, f.key, Number(e.target.value))}
                          />
                        </div>
                      ))
                      : (
                        <div className="flex justify-end items-center gap-3">
                          <div className="text-right">
                            <input
                              type="number"
                              className="bg-transparent text-right font-mono border-b border-transparent focus:border-zinc-400 outline-hidden w-24 p-1"
                              value={selectedCat.logicType === 'staff' ? (item.values?.salary || 0) : (item.values?.amount || 0)}
                              onChange={e => updateItemValue(item.id, selectedCat.logicType === 'staff' ? 'salary' : 'amount', Number(e.target.value))}
                            />
                            <span className="text-[10px] text-zinc-400 block">Base mensual</span>
                          </div>
                        </div>
                      )
                    }

                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleDelete(item.id)} className="text-zinc-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

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
                                onChange={e => setUpdateForm({ ...updateForm, date: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Tipo de aumento</label>
                              <select
                                className="w-full text-xs p-2 border border-zinc-200 rounded-lg outline-hidden"
                                value={updateForm.type}
                                onChange={e => setUpdateForm({ ...updateForm, type: e.target.value as 'amount' | 'percent' })}
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
                                onChange={e => setUpdateForm({ ...updateForm, value: Number(e.target.value) })}
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

                          {/* Bonuses */}
                          <div className="border-t border-zinc-200 pt-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Gift className="w-4 h-4 text-amber-500" />
                              <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-600">Bonus Puntual</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                              <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Fecha</label>
                                <input
                                  type="date"
                                  className="w-full text-xs p-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-hidden"
                                  value={bonusForm.date}
                                  onChange={e => setBonusForm({ ...bonusForm, date: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Concepto</label>
                                <input
                                  type="text"
                                  className="w-full text-xs p-2 border border-zinc-200 rounded-lg outline-hidden"
                                  placeholder="Ej. Bonus navidad"
                                  value={bonusForm.concept}
                                  onChange={e => setBonusForm({ ...bonusForm, concept: e.target.value })}
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase mb-1 block">Importe (€)</label>
                                <input
                                  type="number"
                                  className="w-full text-xs p-2 border border-zinc-200 rounded-lg outline-hidden"
                                  value={bonusForm.amount || ''}
                                  onChange={e => setBonusForm({ ...bonusForm, amount: Number(e.target.value) })}
                                />
                              </div>
                              <div className="flex items-end">
                                <button
                                  onClick={() => handleAddBonus(item.id)}
                                  disabled={!bonusForm.amount}
                                  className="w-full bg-amber-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Añadir Bonus
                                </button>
                              </div>
                            </div>

                            {bonusForm.amount > 0 && (
                              <div className="mt-3 bg-amber-50 p-3 rounded-xl border border-amber-100 text-xs flex items-center justify-between">
                                <span className="text-amber-700">Bonus bruto</span>
                                <span className="font-mono font-bold text-amber-800">
                                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(bonusForm.amount)}
                                </span>
                                <span className="text-amber-500">+SS</span>
                                <span className="font-mono font-bold text-amber-800">
                                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(
                                    bonusForm.amount * (1 + (selectedCat?.config?.ssPercentage || 0.3))
                                  )}
                                </span>
                              </div>
                            )}

                            {item.values.bonuses?.length > 0 && (
                              <div className="space-y-2 mt-4">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Bonuses Programados</span>
                                {item.values.bonuses.map((bonus: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between bg-white px-4 py-2 rounded-lg border border-amber-100 text-xs">
                                    <div className="flex items-center gap-4">
                                      <Gift className="w-3 h-3 text-amber-400" />
                                      <span className="font-medium">{new Date(bonus.date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
                                      {bonus.concept && <span className="text-zinc-500">{bonus.concept}</span>}
                                      <span className="text-zinc-400">|</span>
                                      <span className="font-bold text-amber-600">
                                        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(bonus.amount)}
                                        <span className="text-zinc-400 font-normal ml-1">+ SS</span>
                                      </span>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        const newBonuses = item.values.bonuses.filter((_: any, i: number) => i !== idx);
                                        await updateDoc(doc(db, 'budgetItems', item.id), { 'values.bonuses': newBonuses });
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
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}

              {/* Add New Line */}
              <div className="p-4 grid gap-4 items-center bg-zinc-50/20"
                style={{ gridTemplateColumns: selectedCat.logicType === 'custom' ? `repeat(${customFields.length + 2}, 1fr)` : '6fr 4fr 2fr' }}
              >
                <div>
                  <input
                    className="w-full bg-transparent border-b border-zinc-200 focus:border-zinc-900 outline-hidden p-1 placeholder:text-zinc-300"
                    placeholder={selectedCat.logicType === 'staff' ? 'Nombre del empleado...' : 'Descripción del concepto...'}
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                  />
                </div>
                {selectedCat.logicType === 'custom'
                  ? customFields.map(f => (
                    <div key={f.key} className="flex justify-end">
                      <input
                        type="number"
                        className="bg-transparent text-right border-b border-zinc-200 focus:border-zinc-900 outline-hidden w-24 p-1"
                        placeholder={String(f.defaultValue ?? 0)}
                        value={newItemCustomValues[f.key] ?? ''}
                        onChange={e => setNewItemCustomValues(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                      />
                    </div>
                  ))
                  : (
                    <div className="flex justify-end">
                      <input
                        type="number"
                        className="bg-transparent text-right border-b border-zinc-200 focus:border-zinc-900 outline-hidden w-24 p-1"
                        placeholder="0.00"
                        value={newItemValue}
                        onChange={e => setNewItemValue(Number(e.target.value))}
                      />
                    </div>
                  )
                }
                <div className="flex justify-end">
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
