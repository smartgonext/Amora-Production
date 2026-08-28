import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FiPercent, FiRefreshCw, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const inputCls =
  "w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm";
const btnPrimary =
  "inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50";

function Card({ title, children }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function RecipeScaler() {
  const [bomId, setBomId] = useState('');
  const [target, setTarget] = useState('');
  const [result, setResult] = useState(null);

  const { data: bomsRes, isLoading: bomsLoading } = useQuery({
    queryKey: ['boms', 'all'],
    queryFn: async () => (await apiClient.get('/manufacturing/boms')).data,
  });
  const boms = bomsRes?.data || [];

  const scaleMutation = useMutation({
    mutationFn: (payload) => apiClient.post('/bakery/recipe-scale', payload),
    onSuccess: (res) => {
      setResult(res.data.data);
      toast.success('Recipe scaled');
    },
    onError: (e) => toast.error(e.response?.data?.errors?.[0] || 'Failed to scale recipe'),
  });

  const handleScale = (e) => {
    e.preventDefault();
    if (!bomId || !target) {
      toast.error('Select a recipe and enter a target dough weight');
      return;
    }
    scaleMutation.mutate({ bom_id: Number(bomId), target_dough_weight: Number(target) });
  };

  const reset = () => {
    setBomId('');
    setTarget('');
    setResult(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
          <FiPercent className="text-white text-xl" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">Recipe Scaler</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Scale any bakery recipe (BOM) to a target dough weight using Baker's %.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Scale to a target dough weight">
          <form onSubmit={handleScale} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">
                Recipe / BOM
              </label>
              {bomsLoading ? (
                <p className="text-sm text-slate-400">Loading recipes...</p>
              ) : (
                <select value={bomId} onChange={(e) => setBomId(e.target.value)} className={inputCls}>
                  <option value="">Select a recipe...</option>
                  {boms.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (v{b.version})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">
                Target Dough Weight
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={inputCls}
                placeholder="e.g. 50 kg dough"
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={scaleMutation.isPending} className={btnPrimary}>
                {scaleMutation.isPending ? 'Scaling...' : 'Scale Recipe'}
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <FiRefreshCw /> Reset
              </button>
            </div>
          </form>

          <div className="mt-5 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
            <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              Ingredient amounts are computed as baker's % of flour (flour = 100%). Dough yield and
              bake loss adjust expected dough & finished weight.
            </p>
          </div>
        </Card>

        {result ? (
          <Card title="Scaled Result">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{result.recipe_name}</p>
                <p className="text-xs text-slate-500">Version {result.version}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Target Dough', result.target_dough_weight],
                  ['Flour Weight', result.flour_weight],
                  ['Total Baker %', `${result.total_baker_pct}%`],
                  ['Hydration', `${result.hydration_pct}%`],
                  ['Dough Yield', `${result.dough_yield_pct}%`],
                  ['Bake Loss', `${result.bake_loss_pct}%`],
                  ['Baked Weight', result.expected_baked_weight],
                ].map(([label, val]) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{val}</p>
                  </div>
                ))}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Ingredient Weights</h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {result.items.map((it) => (
                    <div key={it.item_id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600 dark:text-slate-300">
                        Item #{it.material_item_id}
                        <span className="text-slate-400 ml-2">({it.baker_pct}%)</span>
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-white">
                        {it.qty} {it.uom}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card title="Scaled Result">
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FiCheckCircle className="text-slate-300 dark:text-slate-600 w-10 h-10 mb-3" />
              <p className="text-sm text-slate-400">
                Scale a recipe to see the ingredient weights and expected yield here.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
