import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FiClock, FiCheckCircle, FiAlertTriangle, FiPrinter, FiRefreshCw,
  FiUser, FiPhone, FiCalendar, FiDollarSign, FiFilter, FiCheck, FiArrowRight
} from 'react-icons/fi';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

const STAGES = [
  { key: 'NEW_ORDER', label: 'New Orders (POS)', color: 'border-pink-500 bg-pink-50/40 dark:bg-pink-950/20 text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
  { key: 'BAKING', label: 'Baking Sponge', color: 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  { key: 'DECORATING', label: 'Icing & Piping', color: 'border-purple-500 bg-purple-50/40 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  { key: 'READY', label: 'Ready for Store', color: 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  { key: 'DELIVERED', label: 'Delivered & Settled', color: 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
];

export default function CakeOrdersPage() {
  const queryClient = useQueryClient();
  const [filterDate, setFilterDate] = useState('all'); // 'all', 'today', 'tomorrow'
  const [search, setSearch] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Fetch orders with auto-refresh every 12s
  const { data: res, isLoading, refetch } = useQuery({
    queryKey: ['store-cake-orders'],
    queryFn: async () => {
      const resp = await apiClient.get('/store/cake-orders');
      return resp.data;
    },
    refetchInterval: 12000,
  });

  const orders = res?.data || [];

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: async ({ orderId, nextStatus }) => {
      const resp = await apiClient.put(`/store/cake-orders/${orderId}/status`, {
        status: nextStatus,
      });
      return resp.data;
    },
    onSuccess: (data, variables) => {
      toast.success(`Cake order updated to ${variables.nextStatus}`);
      queryClient.invalidateQueries({ queryKey: ['store-cake-orders'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to update order stage');
    },
  });

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (filterDate === 'today' && o.delivery_date !== todayStr) return false;
    if (filterDate === 'tomorrow' && o.delivery_date !== tomorrowStr) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNo = o.order_number?.toLowerCase().includes(q);
      const matchName = o.customer_name?.toLowerCase().includes(q);
      const matchPhone = o.customer_phone?.includes(q);
      const matchFlavor = o.cake_flavor?.toLowerCase().includes(q);
      if (!matchNo && !matchName && !matchPhone && !matchFlavor) return false;
    }
    return true;
  });

  // Print Kitchen Slip
  const printKitchenTicket = (order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Kitchen Cake Ticket - ${order.order_number}</title>
          <style>
            body { font-family: monospace; font-size: 13px; max-width: 320px; margin: 10px auto; padding: 10px; border: 1px dashed #333; }
            h2 { margin: 0; font-size: 16px; text-align: center; }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .bold { font-weight: bold; }
            .highlight { font-size: 14px; background: #eee; padding: 4px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h2>🎂 KITCHEN PRODUCTION TICKET</h2>
          <div class="center bold">AMORA BAKERY</div>
          <div class="center">Order #${order.order_number}</div>
          <div class="divider"></div>
          <div><b>Pickup Date:</b> <span class="highlight">${order.delivery_date}</span></div>
          <div><b>Pickup Time:</b> <span class="highlight">${order.delivery_time || '17:00'}</span></div>
          <div><b>Customer:</b> ${order.customer_name} (${order.customer_phone})</div>
          <div class="divider"></div>
          <div><b>FLAVOR:</b> <span style="font-size: 15px; font-weight: bold;">${order.cake_flavor}</span></div>
          <div><b>Weight:</b> ${order.weight_kg} kg | <b>Shape:</b> ${order.cake_shape}</div>
          <div><b>Dietary:</b> <span style="font-weight: bold; color: ${order.is_eggless ? '#15803d' : '#333'}">${order.is_eggless ? '🌱 EGGLESS' : 'Regular'}</span></div>
          ${order.message_on_cake ? `<div class="divider"></div><div><b>PIPING MESSAGE:</b><br/><i>"${order.message_on_cake}"</i></div>` : ''}
          ${order.special_instructions ? `<div class="divider"></div><div><b>NOTES:</b><br/>${order.special_instructions}</div>` : ''}
          <div class="divider"></div>
          <div style="font-size: 11px;">Booked at POS: Total Rs. ${order.total_price} | Adv: Rs. ${order.advance_paid} | Bal: Rs. ${order.balance_due}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const getNextStage = (current) => {
    if (current === 'NEW_ORDER') return 'BAKING';
    if (current === 'BAKING') return 'DECORATING';
    if (current === 'DECORATING') return 'READY';
    if (current === 'READY') return 'DELIVERED';
    return null;
  };

  const getStageActionLabel = (current) => {
    if (current === 'NEW_ORDER') return 'Start Baking 🧑‍🍳';
    if (current === 'BAKING') return 'Send to Decorating 🎂';
    if (current === 'DECORATING') return 'Mark Ready for Store ✅';
    if (current === 'READY') return 'Mark Delivered 🎁';
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-pink-500 text-white shadow-md text-xl">🎂</span>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                Restaurant Cake Orders Board
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 font-bold animate-pulse">
                  Live POS Integration
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live customized cake bookings from Restaurant POS with advance tracking, audio chime alerts, & kitchen workflow.
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Date Filters */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setFilterDate('all')}
              className={`px-3 py-1.5 rounded-md transition ${filterDate === 'all' ? 'bg-pink-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-black'}`}
            >
              All Orders
            </button>
            <button
              onClick={() => setFilterDate('today')}
              className={`px-3 py-1.5 rounded-md transition ${filterDate === 'today' ? 'bg-pink-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-black'}`}
            >
              Due Today
            </button>
            <button
              onClick={() => setFilterDate('tomorrow')}
              className={`px-3 py-1.5 rounded-md transition ${filterDate === 'tomorrow' ? 'bg-pink-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:text-black'}`}
            >
              Due Tomorrow
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="text-xs text-slate-400 font-medium">Total Bookings</div>
          <div className="text-xl font-black text-slate-800 dark:text-white mt-1">{orders.length}</div>
        </div>
        <div className="p-3.5 rounded-xl border border-pink-200 dark:border-pink-900/50 bg-pink-50/50 dark:bg-pink-950/20 shadow-xs">
          <div className="text-xs text-pink-600 dark:text-pink-400 font-semibold">New Pending</div>
          <div className="text-xl font-black text-pink-700 dark:text-pink-300 mt-1">
            {orders.filter((o) => o.status === 'NEW_ORDER').length}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 shadow-xs">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold">In Baking</div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
            {orders.filter((o) => o.status === 'BAKING').length}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 shadow-xs">
          <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Decorating</div>
          <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
            {orders.filter((o) => o.status === 'DECORATING').length}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 shadow-xs">
          <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Ready for Store</div>
          <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
            {orders.filter((o) => o.status === 'READY').length}
          </div>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {STAGES.map((col) => {
          const colOrders = filteredOrders.filter((o) => o.status === col.key);

          return (
            <div
              key={col.key}
              className="flex flex-col bg-slate-50/80 dark:bg-slate-900/60 rounded-2xl p-3 border border-slate-200 dark:border-slate-800 min-h-[500px]"
            >
              {/* Column Title */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {col.label}
                  </span>
                </div>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                  {colOrders.length}
                </span>
              </div>

              {/* Order Cards List */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {colOrders.length === 0 ? (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-400 text-center px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    No orders in this stage
                  </div>
                ) : (
                  colOrders.map((o) => {
                    const isDueToday = o.delivery_date === todayStr;
                    const nextStage = getNextStage(o.status);
                    const actionLabel = getStageActionLabel(o.status);

                    return (
                      <motion.div
                        key={o.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-3.5 rounded-xl border bg-white dark:bg-slate-800 shadow-sm transition hover:shadow-md ${
                          isDueToday && o.status !== 'DELIVERED'
                            ? 'border-pink-400 dark:border-pink-600'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {/* Order Header */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                            {o.order_number}
                          </span>
                          {isDueToday && o.status !== 'DELIVERED' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white animate-pulse">
                              DUE TODAY
                            </span>
                          )}
                        </div>

                        {/* Cake Description */}
                        <div className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                          {o.cake_flavor}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{o.weight_kg} kg</span>
                          <span>•</span>
                          <span>{o.cake_shape}</span>
                          <span>•</span>
                          <span className={`font-semibold ${o.is_eggless ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                            {o.is_eggless ? '🌱 Eggless' : 'Regular'}
                          </span>
                        </div>

                        {/* Message on cake */}
                        {o.message_on_cake && (
                          <div className="mt-2 p-2 rounded-lg bg-pink-50 dark:bg-pink-950/40 border border-pink-100 dark:border-pink-900/40 text-xs italic text-pink-700 dark:text-pink-300">
                            "{o.message_on_cake}"
                          </div>
                        )}

                        {/* Special instructions */}
                        {o.special_instructions && (
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <b>Note:</b> {o.special_instructions}
                          </div>
                        )}

                        {/* Customer & Pickup Schedule */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 font-medium">
                              <FiUser className="w-3 h-3 text-slate-400" /> {o.customer_name}
                            </span>
                            <span className="text-[11px] text-slate-400">{o.customer_phone}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <FiCalendar className="w-3 h-3 text-pink-500" />
                            <span>Pickup: <strong>{o.delivery_date}</strong> @ {o.delivery_time || '17:00'}</span>
                          </div>
                        </div>

                        {/* Financial summary */}
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400">Total: </span>
                            <span className="font-semibold">₹{Number(o.total_price).toFixed(0)}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400">Bal Due: </span>
                            <span className={`font-bold ${Number(o.balance_due) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                              ₹{Number(o.balance_due).toFixed(0)}
                            </span>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => printKitchenTicket(o)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                            title="Print Kitchen Ticket"
                          >
                            <FiPrinter className="w-3.5 h-3.5" />
                          </button>

                          {nextStage && (
                            <button
                              type="button"
                              onClick={() => statusMutation.mutate({ orderId: o.id, nextStatus: nextStage })}
                              disabled={statusMutation.isPending}
                              className="flex-1 py-1 px-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
                            >
                              <span>{actionLabel}</span>
                              <FiArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

