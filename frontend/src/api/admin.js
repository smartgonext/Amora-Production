/**
 * Admin API client — Phase 12
 * Wraps all /api/v1/superadmin/* and /api/v1/backup/* endpoints.
 * All functions return the Axios response so callers can access .data directly.
 */
import apiClient from './client';

// ── Global stats ─────────────────────────────────────────────────────────────
export const getAdminStats = () =>
  apiClient.get('/superadmin/stats');

// ── Tenant list & detail ──────────────────────────────────────────────────────
export const getTenants = (params = {}) =>
  apiClient.get('/superadmin/tenants', { params });

export const getTenantDetail = (tenantId) =>
  apiClient.get(`/superadmin/tenants/${tenantId}`);

// ── Plans ─────────────────────────────────────────────────────────────────────
export const getPlans = () =>
  apiClient.get('/superadmin/plans');

export const createPlan = (data) =>
  apiClient.post('/superadmin/plans', data);

// ── Remote admin actions ──────────────────────────────────────────────────────
export const suspendTenant = (tenantId, reason) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/suspend`, { reason });

export const reactivateTenant = (tenantId) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/reactivate`);

export const extendExpiry = (tenantId, days) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/extend-expiry`, { days });

export const changePlan = (tenantId, planId) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/change-plan`, { plan_id: planId });

export const resetDevice = (tenantId, deviceRegId) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/devices/${deviceRegId}/reset`);

export const unlockDevice = (tenantId, deviceRegId) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/devices/${deviceRegId}/unlock`);

export const forceLogout = (tenantId, reason) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/force-logout`, { reason });

export const forceUpdateCheck = (tenantId) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/force-update`);

export const sendAnnouncement = (tenantId, { title, message, level }) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/announcement`, { title, message, level });

export const triggerRemoteBackup = (tenantId) =>
  apiClient.post(`/superadmin/tenants/${tenantId}/remote-backup`);

// ── Backup management ─────────────────────────────────────────────────────────
export const listAdminBackups = (tenantId, params = {}) =>
  apiClient.get(`/backup/admin/${tenantId}/list`, { params });
