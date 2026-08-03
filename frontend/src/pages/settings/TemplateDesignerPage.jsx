import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  FiSave, FiType, FiGrid, FiTrash2, FiMove, FiCopy,
  FiAlignLeft, FiAlignCenter, FiAlignRight, FiBold, FiItalic, FiUnderline,
  FiFileText, FiSettings, FiImage as FiImageIcon
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { fetchTemplate, saveTemplate } from '../../api/templates';

const CANVAS_W = 595;
const CANVAS_H = 842;

const DOC_TYPES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'agreement', label: 'Agreement' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'purchase_order', label: 'Purchase Order' },
  { value: 'delivery_challan', label: 'Delivery Challan' },
];

const VARIABLES = ['{{company_name}}','{{company_address}}','{{company_gstin}}','{{company_phone}}','{{company_logo}}','{{invoice_number}}','{{invoice_date}}','{{due_date}}','{{customer_name}}','{{customer_address}}','{{subtotal}}','{{discount}}','{{tax_total}}','{{total}}','{{amount_in_words}}','{{items_table}}','{{signature}}','{{footer_text}}'];

const FONTS = ['Helvetica', 'Courier', 'Times-Roman', 'Helvetica-Bold', 'Courier-Bold', 'Times-Bold'];

const ELEMENT_TYPES = [
  { type: 'text', label: 'Text', icon: FiType },
  { type: 'image', label: 'Image', icon: FiImageIcon },
  { type: 'table', label: 'Table', icon: FiGrid },
  { type: 'signature', label: 'Signature', icon: FiFileText },
];

export default function TemplateDesignerPage() {
  const [docType, setDocType] = useState('invoice');
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [name, setName] = useState('Default');
  const [saved, setSaved] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const canvasRef = useRef(null);

  const { data: template } = useQuery({
    queryKey: ['template-designer', docType],
    queryFn: () => fetchTemplate(docType),
  });

  useEffect(() => {
    if (template) {
      if (template.layout_json?.elements) { setElements(template.layout_json.elements); setSaved(template.layout_json); }
      if (template.name) setName(template.name);
    }
  }, [template, docType]);

  const saveMut = useMutation({
    mutationFn: (payload) => saveTemplate(docType, payload),
    onSuccess: () => toast.success('Template saved!'),
    onError: () => toast.error('Save failed'),
  });

  const selected = elements.find((e) => e.id === selectedId);

  const addElement = (type) => {
    const base = { id: `el_${Date.now()}`, type,
      x_pct: type === 'table' ? 10 : 15, y_pct: type === 'table' ? 35 : 15,
      w_pct: type === 'table' ? 80 : 40, h_pct: type === 'table' ? 30 : 8,
      z_index: elements.length + 1 };
    if (type === 'text') { base.text = 'Enter your text here'; base.font = 'Helvetica'; base.size = 12; base.color = '#000000'; base.align = 'left'; base.bold = false; base.italic = false; base.underline = false; }
    else if (type === 'image') { base.image_url = 'https://placehold.co/150x100?text=Logo'; base.opacity = 100; }
    else if (type === 'table') { base.columns = ['Item','Qty','Rate','Amount']; base.header_bg = '#1e293b'; base.header_text_color = '#ffffff'; }
    else if (type === 'signature') { base.text = 'Authorized Signatory'; base.font = 'Courier'; base.size = 14; base.color = '#000000'; base.align = 'center'; }
    setElements((p) => [...p, base]); setSelectedId(base.id);
  };

  const update = (id, patch) => setElements((p) => p.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  const removeEl = (id) => { setElements((p) => p.filter((el) => el.id !== id)); if (selectedId === id) setSelectedId(null); };
  const duplicate = (id) => {
    const el = elements.find((e) => e.id === id); if (!el) return;
    const copy = { ...el, id: `el_${Date.now()}`, x_pct: el.x_pct + 2, y_pct: el.y_pct + 2 };
    setElements((p) => [...p, copy]); setSelectedId(copy.id);
  };

  const handleSave = () => {
    const blueprint = { canvas_width: CANVAS_W, canvas_height: CANVAS_H,
      elements: elements.map(({ id, ...rest }) => rest) };
    saveMut.mutate({ name, layout_json: blueprint });
    setSaved(blueprint);
  };

  const onDrag = useCallback((e, el) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    update(el.id, { x_pct: x, y_pct: y });
  }, [elements]);

  const onResize = useCallback((e, el) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const w = Math.max(5, Math.min(100 - el.x_pct, ((e.clientX - rect.left - (el.x_pct / 100) * rect.width) / rect.width) * 100));
    const h = Math.max(2, Math.min(100 - el.y_pct, ((e.clientY - rect.top - (el.y_pct / 100) * rect.height) / rect.height) * 100));
    update(el.id, { w_pct: w, h_pct: h });
  }, [elements]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Visual Template Designer</h1>
            <p className="text-slate-300 mt-2 text-sm max-w-2xl">
              Drag, resize, and position text, images, tables, and signatures on an A4 canvas — MS Word style.
            </p>
          </div>
          <button onClick={handleSave} className="flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl shadow-lg">
            <FiSave /><span>{saveMut.isPending ? 'Saving...' : 'Save Template'}</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Document Type</label>
          <div className="flex flex-wrap gap-1.5">
            {DOC_TYPES.map((dt) => (
              <button key={dt.value} onClick={() => setDocType(dt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${docType === dt.value ? 'bg-indigo-600 text-white shadow' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
                {dt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Template Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <button onClick={() => setShowGrid(!showGrid)}
          className={`px-3 py-2 rounded-lg text-sm font-semibold ${showGrid ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
          <FiGrid className="inline mr-1" />Grid
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/60 border-b text-sm font-semibold text-slate-600">
          <span>Insert Elements</span>
          <span className="text-xs text-slate-400">{elements.length} elements placed</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          {ELEMENT_TYPES.map((et) => (
            <button key={et.type} onClick={() => addElement(et.type)}
              className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-700 dark:text-slate-200 hover:text-indigo-600 rounded-lg text-sm font-semibold transition-all">
              <et.icon className="w-4 h-4" /><span>+ {et.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="bg-gray-200 dark:bg-gray-800/80 rounded-xl p-8 shadow-inner overflow-auto">
            <div ref={canvasRef}
              className={`relative bg-white shadow-2xl mx-auto ${showGrid ? 'template-grid' : ''}`}
              style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100%', aspectRatio: '595/842' }}>
              {elements.map((el) => (
                <CanvasElement key={el.id} el={el} isSelected={selectedId === el.id}
                  onSelect={() => setSelectedId(el.id)} onDrag={onDrag} onResize={onResize}
                  onRemove={() => removeEl(el.id)} onDuplicate={() => duplicate(el.id)} />
              ))}
              {elements.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <FiImageIcon className="mx-auto text-5xl text-slate-200 mb-3" />
                    <p className="text-slate-400 font-medium text-sm">Canvas is empty</p>
                    <p className="text-slate-300 text-xs mt-1">Add elements above to start designing</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <PropertyPanel el={selected} onChange={(patch) => update(selected.id, patch)} />
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center">
              <FiMove className="mx-auto text-4xl text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-semibold text-slate-600">Select an element</p>
              <p className="text-xs text-slate-400 mt-1">Click any element on the canvas to edit</p>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 dark:text-white mb-3 flex items-center space-x-2">
              <FiSettings className="w-4 h-4 text-indigo-500" /><span>Dynamic Variables</span>
            </h3>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {VARIABLES.map((v) => (
                <button key={v}
                  onClick={() => {
                    if (selected?.type === 'text') update(selected.id, { text: (selected.text || '') + (selected.text ? ' ' : '') + v });
                    else toast.info('Select a Text element to insert a variable');
                  }}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-slate-500 dark:text-slate-300 rounded font-mono text-[10px]">
                  {v}
                </button>
              ))}
            </div>
          </div>

          {saved && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 dark:text-white mb-3">Saved Blueprint</h3>
              <pre className="text-[10px] bg-slate-50 dark:bg-slate-800 p-3 rounded-lg overflow-auto max-h-40 text-slate-600 font-mono">
{JSON.stringify(saved, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Canvas Element ────────────────────────────────────────── */
function CanvasElement({ el, isSelected, onSelect, onDrag, onResize, onRemove, onDuplicate }) {
  const startDrag = (e) => {
    if (e.target.closest('.no-drag')) return;
    e.preventDefault(); e.stopPropagation(); onSelect();
    const move = (ev) => onDrag(ev, el);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  const startResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const move = (ev) => onResize(ev, el);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  return (
    <div onMouseDown={startDrag} onClick={onSelect}
      className={`absolute cursor-move group ${isSelected ? 'ring-2 ring-indigo-500' : 'hover:ring-1 hover:ring-indigo-300'}`}
      style={{ left: `${el.x_pct}%`, top: `${el.y_pct}%`, width: `${el.w_pct}%`, height: `${el.h_pct}%`, zIndex: el.z_index || 1 }}>
      <div className="w-full h-full overflow-hidden rounded-sm border border-slate-200 dark:border-slate-600">
        {el.type === 'text' && (
          <div className="w-full h-full px-2 py-1 flex items-center" style={{
            fontFamily: el.font, fontSize: el.size, color: el.color,
            fontWeight: el.bold ? 'bold' : 'normal', fontStyle: el.italic ? 'italic' : 'normal',
            textDecoration: el.underline ? 'underline' : 'none', textAlign: el.align || 'left' }}>
            <span>{el.text || 'Enter text'}</span>
          </div>
        )}
        {el.type === 'image' && (
          <img src={el.image_url} alt="asset" className="w-full h-full object-contain" style={{ opacity: (el.opacity || 100) / 100 }} />
        )}
        {el.type === 'table' && (
          <TablePreview el={el} />
        )}
        {el.type === 'signature' && (
          <div className="w-full h-full flex items-center justify-center italic opacity-80"
            style={{ fontFamily: el.font, fontSize: el.size, color: el.color }}>
            {el.text || 'Signature'}
          </div>
        )}
      </div>

      {isSelected && (
        <>
          <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onRemove()}
            className="no-drag absolute -top-3 -right-3 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg z-20 hover:bg-rose-600" title="Delete">
            <FiTrash2 className="w-3 h-3" />
          </button>
          <button onMouseDown={(e) => e.stopPropagation()} onClick={() => onDuplicate()}
            className="no-drag absolute -top-3 -left-3 w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-lg z-20 hover:bg-indigo-600" title="Duplicate">
            <FiCopy className="w-3 h-3" />
          </button>
          <div onMouseDown={startResize}
            className="no-drag absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-indigo-500 border-2 border-white rounded-sm cursor-se-resize z-20 shadow" title="Resize" />
        </>
      )}
    </div>
  );
}

function TablePreview({ el }) {
  const cols = el.columns || ['Item', 'Qty', 'Rate', 'Amount'];
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 grid gap-px bg-slate-200 dark:bg-slate-600" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
        {cols.map((c, i) => (
          <div key={i} className="flex items-center justify-center text-[9px] font-bold px-1 truncate" style={{ backgroundColor: el.header_bg, color: el.header_text_color }}>{c}</div>
        ))}
      </div>
      {[0, 1].map((row) => (
        <div key={row} className="flex-1 grid gap-px bg-slate-200 dark:bg-slate-600" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
          {cols.map((c, i) => (
            <div key={i} className="flex items-center justify-center text-[8px] px-1 truncate bg-white dark:bg-slate-700 text-slate-400">
              {i === 0 ? 'Item name' : i === cols.length - 1 ? '₹0.00' : '—'}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Property Panel ────────────────────────────────────────── */
function PropertyPanel({ el, onChange }) {
  const [advanced, setAdvanced] = useState(false);
  const num = (key, defaultVal) => (
    <input type="number" value={Math.round((el[key] ?? defaultVal) * 10) / 10}
      onChange={(e) => onChange({ [key]: parseFloat(e.target.value) || defaultVal })}
      className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-md text-xs" />
  );
  const colorInput = (key, defaultVal) => (
    <div className="flex items-center gap-2">
      <input type="color" value={el[key] || defaultVal} onChange={(e) => onChange({ [key]: e.target.value })}
        className="w-10 h-8 rounded border border-slate-200 cursor-pointer" />
      <span className="text-xs font-mono text-slate-500">{el[key] || defaultVal}</span>
    </div>
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 dark:text-white uppercase tracking-wider">{el.type} Properties</h3>
        <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500">#{el.id.slice(-6)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">X (%)</label>{num('x_pct', 0)}</div>
        <div><label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Y (%)</label>{num('y_pct', 0)}</div>
        <div><label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Width (%)</label>{num('w_pct', 10)}</div>
        <div><label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Height (%)</label>{num('h_pct', 5)}</div>
      </div>

      {el.type === 'text' && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Text Content</label>
            <textarea value={el.text || ''} onChange={(e) => onChange({ text: e.target.value })} rows={3}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Font</label>
              <select value={el.font} onChange={(e) => onChange({ font: e.target.value })}
                className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-md text-xs">
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Size</label>
              <input type="number" value={el.size || 12} min={6} max={72}
                onChange={(e) => onChange({ size: parseInt(e.target.value) || 12 })}
                className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-md text-xs" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Color</label>
            {colorInput('color', '#000000')}
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Alignment</label>
            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
              {[{ a: 'left', i: FiAlignLeft }, { a: 'center', i: FiAlignCenter }, { a: 'right', i: FiAlignRight }].map((x) => (
                <button key={x.a} onClick={() => onChange({ align: x.a })}
                  className={`p-2 rounded-md ${(el.align || 'left') === x.a ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>
                  <x.i className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex space-x-1">
            {[{ k: 'bold', i: FiBold }, { k: 'italic', i: FiItalic }, { k: 'underline', i: FiUnderline }].map((s) => (
              <button key={s.k} onClick={() => onChange({ [s.k]: !el[s.k] })}
                className={`p-2 rounded-lg ${el[s.k] ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                <s.i className="w-4 h-4" />
              </button>
            ))}
          </div>
        </>
      )}

      {el.type === 'image' && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Image URL</label>
            <input value={el.image_url || ''} onChange={(e) => onChange({ image_url: e.target.value })}
              placeholder="https://... or /uploads/..."
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Opacity: {el.opacity || 100}%</label>
            <input type="range" min={0} max={100} value={el.opacity || 100} onChange={(e) => onChange({ opacity: parseInt(e.target.value) })} className="w-full" />
          </div>
        </>
      )}

      {el.type === 'table' && (
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Columns (comma separated)</label>
          <input value={(el.columns || []).join(', ')}
            onChange={(e) => onChange({ columns: e.target.value.split(',').map((c) => c.trim()).filter(Boolean) })}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg text-xs" />
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div><label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Header BG</label>{colorInput('header_bg', '#1e293b')}</div>
            <div><label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Header Text</label>{colorInput('header_text_color', '#ffffff')}</div>
          </div>
        </div>
      )}

      {el.type === 'signature' && (
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Signature Label</label>
          <input value={el.text || ''} onChange={(e) => onChange({ text: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-lg text-xs" />
        </div>
      )}

      <button onClick={() => setAdvanced(!advanced)}
        className="w-full text-xs font-semibold text-slate-500 hover:text-indigo-600 flex items-center justify-center space-x-1 py-1">
        <FiSettings className="w-3 h-3" /><span>{advanced ? 'Hide Advanced' : 'Show Advanced'}</span>
      </button>
      {advanced && (
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Z-Index</label>
          <input type="number" value={el.z_index || 1} onChange={(e) => onChange({ z_index: parseInt(e.target.value) || 1 })}
            className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-md text-xs" />
        </div>
      )}
    </div>
  );
}