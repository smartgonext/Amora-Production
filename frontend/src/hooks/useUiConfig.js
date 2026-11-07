import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';

/**
 * Fetch the tenant's effective UI config (Company-Type driven module gating).
 *
 * The backend resolves which top-level modules and feature flags are shown for
 * the company's selected business type. If the request fails (e.g. no company
 * yet) we return an "everything enabled" fallback so navigation is never
 * stripped away by a transient error.
 */
export function useUiConfig() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ui-config'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/setup/ui-config');
        return res.data?.data || null;
      } catch (e) {
        return null; // gracefully default to everything-enabled
      }
    },
    retry: 1,
  });

  const ui = data || null;
  const enabledModules = ui?.enabled_modules?.length
    ? new Set(ui.enabled_modules.map((m) => String(m).toLowerCase()))
    : null; // null => no restriction (show all)

  /**
   * True when a specific module is allowed. When `enabledModules` is null
   * (config missing / still loading) we show everything, so the nav never
   * disappears while the config resolves.
   */
  const isModuleEnabled = (moduleCode) => {
    if (!moduleCode) return true;
    const code = String(moduleCode).toLowerCase();
    if (code === 'dashboard') return true;
    if (!enabledModules) return true;
    return enabledModules.has(code);
  };

  return {
    ui,
    isLoading,
    error,
    enabledModules,
    isModuleEnabled,
  };
}
