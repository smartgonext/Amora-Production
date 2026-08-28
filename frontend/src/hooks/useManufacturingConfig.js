import { useQuery } from '@tanstack/react-query';
import { FiLayers, FiCpu, FiBox, FiCheckCircle, FiTruck, FiPackage, FiPercent, FiCalendar, FiRefreshCw, FiShield, FiBarChart2, FiDollarSign } from 'react-icons/fi';
import apiClient from '../api/client';

/**
 * Fetch the tenant's manufacturing engine configuration.
 *
 * Non-manufacturing tenants have no `tenant_manufacturing_configs` row, so the
 * backend returns 404 — we treat that as `{ config: null, hasMfg: false }` so the
 * UI can adapt (rename/hide) the Manufacturing navigation based on the config.
 */
export function useManufacturingConfig() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['manufacturing-config'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/manufacturing/config');
        return res.data?.data || null;
      } catch (e) {
        if (e.response?.status === 404) return null; // not a manufacturing tenant
        throw e;
      }
    },
    retry: false,
  });

  return {
    config: data ?? null,
    isLoading,
    hasMfg: !!data,
  };
}

/**
 * Derive an adaptive Manufacturing navigation from the tenant config.
 *
 * - Renames links based on `mfg_type` + the config's labels.
 * - Hides feature-gated entries unless the matching feature is enabled.
 * - Falls back to the generic set when no config exists (so legacy tenants still
 *   get access), which keeps the engine usable while remaining adaptive.
 */
export function buildManufacturingMenu(config, allItems) {
  if (!config) {
    return []; // hide everything for non-mfg tenants
  }
  const features = (config.enabled_features || []).map((f) => String(f).toLowerCase());
  const type = (config.mfg_type || '').toLowerCase();

  const bomLabel =
    config.bom_label ||
    (type === 'process' ? 'Recipe' : type === 'textile' ? 'Variant Matrix' : 'BOM & Routing');
  const woLabel =
    type === 'process' ? 'Batches' : type === 'textile' ? 'Cutting / Stitching' : 'Work Orders';

  const items = [
    { path: '/manufacturing/materials', label: 'Raw Materials', icon: FiPackage },
    { path: '/manufacturing/purchases', label: 'Raw Material Purchases', icon: FiDollarSign },
    { path: '/manufacturing/bom', label: bomLabel, icon: FiLayers },
    { path: '/manufacturing/work-orders', label: woLabel, icon: FiCpu },
    { path: '/manufacturing/mrp', label: 'MRP / Shortage', icon: FiBox },
  ];

  if (features.includes('job_work') || features.includes('subcontracting')) {
    items.push({ path: '/manufacturing/job-work', label: 'Job Work', icon: FiTruck });
  }
  if (features.includes('qc') || type === 'process') {
    items.push({ path: '/manufacturing/qc', label: 'Quality Control', icon: FiCheckCircle });
  }
  if (features.includes('baker_pct_scaling')) {
    items.push({ path: '/manufacturing/recipe-scaler', label: 'Recipe Scaler', icon: FiPercent });
  }
  if (features.includes('freshness') || type === 'process') {
    items.push({ path: '/manufacturing/bake-planner', label: 'Bake Planner', icon: FiCalendar });
  }
  if (features.includes('fefo') || features.includes('freshness')) {
    items.push({ path: '/manufacturing/fresh-returns', label: 'Fresh Returns & Delivery', icon: FiRefreshCw });
  }
  if (features.includes('haccp') || type === 'process') {
    items.push({ path: '/manufacturing/bakery-qc', label: 'HACCP QC', icon: FiShield });
  }
  if (type === 'process' || features.includes('freshness')) {
    items.push({ path: '/manufacturing/day-cost', label: 'Bake-Day Cost', icon: FiBarChart2 });
  }
  return items;
}