import React, { useState } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
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

  const handleMagic = async () => {
    if (!prompt) return;
    setLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${context ? `CONTEXTO ACTUAL: ${context}\n` : ''}INSTRUCCIÓN DEL USUARIO: "${prompt}"

        Analiza la instrucción y devuelve la configuración de categoría de presupuesto más adecuada. 
        Si el usuario pide cambiar algo del contexto actual, prioriza su petición.

        Lógicas disponibles:
        - staff: Personal. Incluye sueldos base y permite programar aumentos salariales futuros. Úsala para profesores, administración, etc.
        - fixed: Gastos fijos mensuales.
        - invoiced: Facturas variables (ej. material escolar, suministros).
        - variable: Gastos manuales mes a mes.
        
        Si el usuario menciona "profesor", "sueldo", "nómina" o "personal", usa obligatoriamente logicType: "staff".
        Si el usuario menciona un aumento o actualización salarial, asegúrate de devolver logicType: "staff".

        Devuelve un JSON con:
        {
          "name": "Nombre de la categoría",
          "type": "income" o "expense",
          "logicType": "staff", "fixed", "invoiced" o "variable",
          "config": { "ssPercentage": 0.3 } 
        }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["income", "expense"] },
              logicType: { type: Type.STRING, enum: ["staff", "fixed", "variable", "invoiced"] },
              config: { type: Type.OBJECT }
            },
            required: ["name", "type", "logicType", "config"]
          }
        }
      });

      const data = JSON.parse(response.text);
      onSuccess(data);
      setIsOpen(false);
      setPrompt('');
    } catch (error) {
      console.error("AI Error:", error);
    } finally {
      setLoading(false);
    }
  };

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
                <div className="p-3 bg-sky-500 rounded-2xl shadow-lg shadow-sky-200">
                  <BrainCircuit className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Asistente de Presupuesto</h3>
                  <p className="text-sm text-zinc-500">Explica cómo funciona este gasto/ingreso en lenguaje natural.</p>
                </div>
              </div>

              <textarea 
                className="w-full h-32 p-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-hidden transition-all resize-none text-zinc-700"
                placeholder="Ejemplo: Tengo 3 personas en la oficina, cada una cobra 2000€ brutos y quiero calcular la seguridad social al 30%..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />

              <div className="flex gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 button-secondary"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleMagic}
                  disabled={loading || !prompt}
                  className="flex-3 button-primary bg-sky-600 hover:bg-sky-700 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Analizar y Configurar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
