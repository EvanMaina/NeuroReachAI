/**
 * Authentication API service.
 *
 * Thin wrappers around the /api/auth/* and /api/users/* endpoints.
 * Token persistence is handled by the useAuth hook; this module only
 * makes the HTTP calls.
 */

import { apiClient } from './api';

// =============================================================================
// Types
// =============================================================================

export interface IUserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'primary_admin' | 'administrator' | 'coordinator' | 'specialist';
  status: 'active' | 'inactive' | 'pending';
  must_change_password: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface ILoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: IUserProfile;
  must_change_password: boolean;
}

export interface IMeResponse {
  user: IUserProfile;
  permissions: string[];
}

export interface IChangePasswordResponse {
  success: boolean;
  message: string;
}

// User management
export interface IUserCreatePayload {
  email: string;
  first_name: string;
  last_name: string;
  role: 'administrator' | 'coordinator' | 'specialist';
}

export interface IUserUpdatePayload {
  first_name?: string;
  last_name?: string;
  role?: string;
  status?: string;
}

export interface IUserListResponse {
  items: IUserProfile[];
  total: number;
}

export interface IPreferences {
  notify_new_lead: boolean;
  notify_hot_lead: boolean;
  notify_daily_summary: boolean;
}

export interface IClinicSettings {
  clinic_name: string;
  clinic_address: string;
  clinic_phone: string;
  clinic_email: string;
}

// =============================================================================
// Auth Calls
// =============================================================================

export async function login(email: string, password: string): Promise<ILoginResponse> {
  const res = await apiClient.post<ILoginResponse>('/api/auth/login', { email, password });
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/api/auth/logout');
  } catch {
    // Best-effort; token is discarded client-side regardless
  }
}

export async function getMe(): Promise<IMeResponse> {
  const res = await apiClient.get<IMeResponse>('/api/auth/me');
  return res.data;
}

export async function changePassword(currentPassword: string | null, newPassword: string): Promise<IChangePasswordResponse> {
  const res = await apiClient.post<IChangePasswordResponse>('/api/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return res.data;
}

// =============================================================================
// Forgot Password / Reset Password
// =============================================================================

export interface IForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface IValidateResetTokenResponse {
  valid: boolean;
  message: string;
}

export interface IResetPasswordResponse {
  success: boolean;
  message: string;
}

export async function forgotPassword(email: string): Promise<IForgotPasswordResponse> {
  const res = await apiClient.post<IForgotPasswordResponse>('/api/auth/forgot-password', { email });
  return res.data;
}

export async function validateResetToken(token: string): Promise<IValidateResetTokenResponse> {
  const res = await apiClient.get<IValidateResetTokenResponse>('/api/auth/validate-reset-token', {
    params: { token },
  });
  return res.data;
}

export async function resetPassword(token: string, newPassword: string): Promise<IResetPasswordResponse> {
  const res = await apiClient.post<IResetPasswordResponse>('/api/auth/reset-password', {
    token,
    new_password: newPassword,
  });
  return res.data;
}

// =============================================================================
// User Management (admin)
// =============================================================================

export async function listUsers(): Promise<IUserListResponse> {
  const res = await apiClient.get<IUserListResponse>('/api/users');
  return res.data;
}

export async function createUser(payload: IUserCreatePayload): Promise<IUserProfile> {
  const res = await apiClient.post<IUserProfile>('/api/users', payload);
  return res.data;
}

export async function updateUser(id: string, payload: IUserUpdatePayload): Promise<IUserProfile> {
  const res = await apiClient.put<IUserProfile>(`/api/users/${id}`, payload);
  return res.data;
}

export async function deactivateUser(id: string): Promise<void> {
  await apiClient.delete(`/api/users/${id}`);
}

// =============================================================================
// Preferences
// =============================================================================

export async function getMyPreferences(): Promise<IPreferences> {
  const res = await apiClient.get<IPreferences>('/api/users/me/preferences');
  return res.data;
}

export async function updateMyPreferences(payload: Partial<IPreferences>): Promise<IPreferences> {
  const res = await apiClient.put<IPreferences>('/api/users/me/preferences', payload);
  return res.data;
}

// =============================================================================
// Clinic Settings
// =============================================================================

export async function getClinicSettings(): Promise<IClinicSettings> {
  const res = await apiClient.get<IClinicSettings>('/api/users/clinic-settings');
  return res.data;
}

export async function updateClinicSettings(payload: Partial<IClinicSettings>): Promise<IClinicSettings> {
  const res = await apiClient.put<IClinicSettings>('/api/users/clinic-settings', payload);
  return res.data;
}

// =============================================================================
// Access Request (public)
// =============================================================================

export interface IAccessRequestPayload {
  full_name: string;
  email: string;
  reason: string;
}

export interface IAccessRequestResponse {
  success: boolean;
  message: string;
}

export async function requestAccess(payload: IAccessRequestPayload): Promise<IAccessRequestResponse> {
  const res = await apiClient.post<IAccessRequestResponse>('/api/auth/request-access', payload);
  return res.data;
}
