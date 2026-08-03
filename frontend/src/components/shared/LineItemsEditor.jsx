import { useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { formatINR } from '../../utils/format';

const PRODUCT_UNITS = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Sqft', 'Box', 'Pair', 'Set'];
const SERVICE_UNITS = ['Hour', 'Day', 'Month', 'Fixed'];
const GST_RATES = [0, 5, 12, 18, 28];

const EMPTY_ITEM = {
  product_id: null,
  product_name: '',
  hsn_code: '',
  qty: 1,
  unit: 'Nos',
  rate: 0,
  discount_percent: 0,
  tax_percent: 18,
  is_service: false
};

function computeItem(item) {
  const qty = parseFloat(item.qty) || 0;
  const rate = parseFloat(item.rate) || 0;
  const amount = qty * rate;
  const discPct = parseFloat(item.discount_percent) || 0;
  const discAmt = (amount * discPct) / 100;
  const taxPct = parseFloat(item.tax_percent) || 0;
  const taxAmt = (amount - discAmt) * taxPct / 100;
  return {
    ...item,
    amount,
    discount_amount: discAmt,
    tax_amount: taxAmt,
    line_total: amount - discAmt + taxAmt,
  };
}

export default function LineItemsEditor({ items = [], onChange, products = [], sourceType = 'Sales' }) {
  const update = (idx, key, val) => {
    const next = items.map((item, i) => {
      if (i !== idx) return item;
      
      // Auto-switch rate when unit changes for equipment items
      if (key === 'unit' && item.hourly_rate && item.daily_rate) {
        if (val === 'Hour') {
          return computeItem({ ...item, unit: val, rate: item.hourly_rate });
        } else if (val === 'Day') {
          return computeItem({ ...item, unit: val, rate: item.daily_rate });
        }
      }
      
      return computeItem({ ...item, [key]: val });
    });
    onChange(next);
  };

  const addRow = () => {
    onChange([...items, computeItem({ ...EMPTY_ITEM })]);
  };

  const removeRow = (idx) => {
    if (items.length <= 1) {
      onChange([computeItem({ ...EMPTY_ITEM })]);
      return;
    }
    onChange(items.filter((_, i) => i !== idx));
  };

  const pickItem = (idx, item) => {
    const next = items.map((itm, i) => {
      if (i !== idx) return itm;
      
      if (item._type === 'product' || sourceType === 'Sales') {
        return computeItem({
          ...itm,
          product_id: item.id,
          product_name: item.name,
          hsn_code: item.hsn_code || '',
          rate: item.selling_price || 0,
          unit: item.unit || (item.is_service ? 'Hour' : 'Nos'),
          tax_percent: item.gst_rate || 18,
          is_service: !!item.is_service
        });
      } else if (item._type === 'equipment' || sourceType === 'Rental') {
        return computeItem({
          ...itm,
          product_id: item.id,
          product_name: item.name,
          hsn_code: item.registration_number || item.serial_number || '',
          rate: item.selling_price || item.daily_rate || item.min_daily_rate || 0,
          unit: 'Day',
          tax_percent: 18,
          is_service: true,
          hourly_rate: item.hourly_rate || item.min_hourly_rate || 0,
          daily_rate: item.daily_rate || item.min_daily_rate || 0
        });
      } else {
        const name = item.contract_title || item.machine_name || 'AMC Contract';
        return computeItem({
          ...itm,
          product_id: item.id,
          product_name: name,
          hsn_code: item.machine_serial || item.id?.toString() || '',
          rate: item.amc_value || item.selling_price || 0,
          unit: 'Fixed',
          tax_percent: 18,
          is_service: true
        });
      }
    });
    onChange(next);
  };

  const subtotal = items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const discTotal = items.reduce((s, i) => s + (parseFloat(i.discount_amount) || 0), 0);
  const taxTotal = items.reduce((s, i) => s + (parseFloat(i.tax_amount) || 0), 0);
  const grandTotal = items.reduce((s, i) => s + (parseFloat(i.line_total) || 0), 0);

  // Get display info based on source type
  const getItemInfo = (item) => {
    if (item._type === 'product' || sourceType === 'Sales') {
      return {
        placeholder: 'Search product...',
        name: item.name,
        price: item.selling_price,
        sku: item.sku,
        type: 'Product',
        detail: `📦 ${item.sku ? `[${item.sku}] ` : ''}₹${item.selling_price}`
      };
    } else if (item._type === 'equipment' || sourceType === 'Rental') {
      const daily = item.daily_rate || item.min_daily_rate;
      const hourly = item.hourly_rate || item.min_hourly_rate;
      return {
        placeholder: 'Search equipment...',
        name: item.name,
        price: daily || hourly,
        sku: item.serial_number,
        type: 'Equipment',
        detail: `🚜 ${hourly ? `₹${hourly}/hr ` : ''}${daily ? `₹${daily}/day` : ''}`
      };
    } else {
      const name = item.contract_title || item.machine_name || 'AMC Contract';
      return {
        placeholder: 'Search AMC contract...',
        name: name,
        price: item.amc_value || item.selling_price,
        sku: item.machine_serial,
        type: 'AMC',
        detail: `🔧 ₹${item.amc_value || item.selling_price}`
      };
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <table className="w-full text-left border-collapse text-xs md:text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold tracking-wider">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4 min-w-[200px]">Item / Description</th>
              <th className="py-3 px-4 w-28">HSN / SAC</th>
              <th className="py-3 px-4 w-24 text-right">Qty</th>
              <th className="py-3 px-4 w-28">Unit</th>
              <th className="py-3 px-4 w-28 text-right">Rate (₹)</th>
              <th className="py-3 px-4 w-24 text-right">Disc %</th>
              <th className="py-3 px-4 w-28">GST %</th>
              <th className="py-3 px-4 w-32 text-right">Total (₹)</th>
              <th className="py-3 px-4 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400 dark:text-slate-500">
                  No items added. Click "+ Add Line Item" below to start.
                </td>
              </tr>
            )}
            {items.map((item, idx) => {
              const currentUnits = item.is_service ? SERVICE_UNITS : PRODUCT_UNITS;
              return (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                  <td className="py-3 px-4 text-center font-semibold text-slate-400">{idx + 1}</td>
                  
                  {/* Name / Item Selection */}
                  <td className="py-2 px-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search products, equipment or AMC..."
                        value={item.product_name}
                        onChange={(e) => {
                          const val = e.target.value;
                          update(idx, 'product_name', val);
                          const matched = products.find(p => {
                            const pName = p.name || p.contract_title || p.machine_name || '';
                            return pName.toLowerCase() === val.toLowerCase();
                          });
                          if (matched) {
                            pickItem(idx, matched);
                          }
                        }}
                        list={`shared-prod-list-${idx}`}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs md:text-sm"
                      />
                      {products.length > 0 && (
                        <datalist id={`shared-prod-list-${idx}`}>
                          {products.map(p => {
                            const info = getItemInfo(p);
                            return (
                              <option key={p.id} value={info.name}>
                                {info.detail}
                              </option>
                            );
                          })}
                        </datalist>
                      )}
                    </div>
                  </td>

                  {/* HSN / Code */}
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      placeholder="Code"
                      value={item.hsn_code}
                      onChange={(e) => update(idx, 'hsn_code', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs md:text-sm"
                    />
                  </td>

                  {/* Qty */}
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={item.qty}
                      onChange={(e) => update(idx, 'qty', parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right text-xs md:text-sm"
                    />
                  </td>

                  {/* Unit */}
                  <td className="py-2 px-3">
                    <select
                      value={item.unit}
                      onChange={(e) => update(idx, 'unit', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs md:text-sm"
                    >
                      {currentUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>

                  {/* Rate */}
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={(e) => update(idx, 'rate', parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right text-xs md:text-sm font-semibold"
                    />
                  </td>

                  {/* Discount % */}
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={item.discount_percent}
                      onChange={(e) => update(idx, 'discount_percent', parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-right text-xs md:text-sm"
                    />
                  </td>

                  {/* GST % */}
                  <td className="py-2 px-3">
                    <select
                      value={item.tax_percent}
                      onChange={(e) => update(idx, 'tax_percent', parseInt(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs md:text-sm"
                    >
                      {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>

                  {/* Total Line Amount */}
                  <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                    {formatINR(item.line_total || 0)}
                  </td>

                  {/* Remove Action */}
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center space-x-1.5 text-xs md:text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors"
      >
        <FiPlus className="text-sm" />
        <span>Add Line Item</span>
      </button>

      {items.length > 0 && (
        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="w-72 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-150 dark:border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs md:text-sm text-slate-500">
              <span>Gross Subtotal</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-xs md:text-sm text-slate-500">
              <span>Item Discount</span>
              <span className="font-semibold text-rose-600">-{formatINR(discTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-xs md:text-sm text-slate-500">
              <span>Tax (GST) Amount</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatINR(taxTotal)}</span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
            <div className="flex justify-between items-center text-sm md:text-base font-bold">
              <span className="text-slate-800 dark:text-white">Net Payable</span>
              <span className="text-indigo-600 dark:text-indigo-400">{formatINR(grandTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}