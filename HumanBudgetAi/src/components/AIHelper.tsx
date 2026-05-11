import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BrainCircuit, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface AIHelperProps {
  onSuccess: (data: { name: string, type: 'income' | 'expense', logicType: string, config: any }) => void;
  context?: string;
}

export default function AIHelper({ onSuccess, context = '' }: AIHelperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleMagic = async () => {
    if (!prompt) return;
    setLoading(true);
    setError('');

    if (import.meta.env.DEV) {
      try {
        await fetch('/api/ai-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: prompt, context })
        });
        setSent(true);
        setPrompt('');
      } catch {
        setError('No se pudo conectar con el servidor de desarrollo.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `${context ? `CONTEXTO ACTUAL: ${context}\n` : ''}INSTRUCCIÓN DEL USUARIO: "${prompt}"

Analiza la instrucción y devuelve la configuración de categoría de presupuesto más adecuada.

LÓGICAS DISPONIBLES:
- "staff": Personal. Sueldos base con posibilidad de aumentos programados y Seguridad Social. Usa para empleados, profesores, etc.
- "fixed": Gastos o ingresos fijos que se repiten igual cada mes.
- "invoiced": Basado en facturas específicas introducidas por el usuario.
- "variable": Cantidades que el usuario introduce manualmente mes a mes.
- "custom": Lógica personalizada con JavaScript. USAR cuando se necesite:
  * Calcular impuestos (IVA, IRPF, retenciones)
  * Generar provisiones trimestrales o anuales automáticas
  * Combinar facturas con porcentajes variables
  * Cualquier cálculo que no encaje en los tipos anteriores

Para logicType "staff": config debe incluir { "ssPercentage": 0.3 }

Para logicType "custom": config debe incluir:
- "description": string explicando en español qué hace esta categoría
- "customFields": array de campos por ítem (puede ser [] si solo usa facturas). Cada campo: { "key": string, "label": string, "type": "number"|"text"|"percentage", "defaultValue": any }
- "customFunction": string con función JavaScript llamada "calculate" con esta firma exacta:
  function calculate({ month, year, items, invoices }) {
    // month: 0-11, year: número
    // items: array con .values conteniendo los customFields
    // invoices: array con .amount, .date (YYYY-MM-DD), .description
    // Retorna: { amount: number, provisions: [{ date: 'YYYY-MM', concept: string, amount: number }] }
  }

EJEMPLO de customFunction para externo con IVA 21% e IRPF 15% con provisiones trimestrales:
function calculate({ month, year, items, invoices }) {
  var monthInvoices = invoices.filter(function(inv) {
    var d = new Date(inv.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  var subtotal = monthInvoices.reduce(function(sum, inv) { return sum + inv.amount; }, 0);
  var provisions = [];
  var quarter = Math.floor(month / 3);
  if (month === quarter * 3 + 2) {
    var quarterInvoices = invoices.filter(function(inv) {
      var d = new Date(inv.date);
      return d.getFullYear() === year && Math.floor(d.getMonth() / 3) === quarter;
    });
    var qSubtotal = quarterInvoices.reduce(function(sum, inv) { return sum + inv.amount; }, 0);
    var nextMonth = (quarter + 1) * 3;
    var pYear = nextMonth >= 12 ? year + 1 : year;
    var pMonth = String((nextMonth % 12) + 1).padStart(2, '0');
    provisions.push({ date: pYear + '-' + pMonth, concept: 'Retención IRPF T' + (quarter + 1), amount: qSubtotal * 0.15 });
  }
  return { amount: subtotal * 1.21 * 0.85, provisions: provisions };
}

Responde SOLO con JSON válido (sin markdown) con esta estructura:
{
  "name": "Nombre de la categoría",
  "type": "income" o "expense",
  "logicType": "staff" | "fixed" | "variable" | "invoiced" | "custom",
  "config": { ... campos según logicType ... }
}`,
        config: {
          responseMimeType: "application/json"
        }
      });

      const raw = response.text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const data = JSON.parse(raw);
      onSuccess(data);
      setIsOpen(false);
      setPrompt('');
    } catch (err: any) {
      console.error("AI Error:", err?.message || err);
      setError(`Error: ${err?.message || 'Respuesta inválida'}. Inténtalo de nuevo.`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setIsOpen(false); setError(''); setSent(false); };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-xs font-bold text-sky-600 bg-sky-50 px-3 py-1.5 rounded-full hover:bg-sky-100 transition-all border border-sky-100"
      >
        <Sparkles className="w-3.5 h-3.5" />
        {context ? 'Refinar con IA' : 'Configuración Asistida'}
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/20 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl border border-zinc-200"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-2xl shadow-lg ${sent ? 'bg-emerald-500 shadow-emerald-200' : 'bg-sky-500 shadow-sky-200'}`}>
                  <BrainCircuit className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Asistente de Presupuesto</h3>
                  <p className="text-sm text-zinc-500">
                    {import.meta.env.DEV
                      ? 'Modo desarrollo — la petición se enviará a Claude Code.'
                      : 'Describe cómo funciona este gasto/ingreso. La IA generará la lógica completa.'}
                  </p>
                </div>
              </div>

              {sent ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
                  <p className="text-2xl">✓</p>
                  <p className="font-bold text-emerald-800">Petición enviada</p>
                  <p className="text-sm text-emerald-700">
                    Recibirás una notificación y verás la petición en la terminal.<br />
                    Escríbeme <strong>"implementa la petición pendiente"</strong> en Claude Code.
                  </p>
                </div>
              ) : (
                <>
                  <textarea
                    className="w-full h-36 p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-hidden transition-all resize-none text-zinc-700"
                    placeholder="Ejemplo: Quiero una categoría para consultor externo con IVA 21%, retención IRPF 15%, y provisiones trimestrales del IRPF..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                  />
                  {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
                </>
              )}

              <div className="flex gap-3 mt-6">
                <button type="button" onClick={handleClose} className="flex-1 button-secondary">
                  {sent ? 'Cerrar' : 'Cancelar'}
                </button>
                {!sent && (
                  <button
                    type="button"
                    onClick={handleMagic}
                    disabled={loading || !prompt}
                    className="flex-3 button-primary bg-sky-600 hover:bg-sky-700 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {import.meta.env.DEV ? 'Enviar a Claude Code' : 'Analizar y Configurar'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
