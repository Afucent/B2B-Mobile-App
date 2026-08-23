import { apiRequest } from '@/lib/api/client';
import { isEmail } from '@/lib/format';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface OrganizationBrief {
  id: string;
  name: string;
  company_code: string;
  industry_type_code: string;
  status: string;
  enabled_modules?: string[];
}

export interface PermissionBrief {
  module: string;
  action: string;
  scope: string;
}

export interface RoleBrief {
  id: string;
  name: string;
}

export interface MeResponse {
  id: string;
  name: string;
  personal_email: string;
  mobile: string | null;
  avatar_url?: string | null;
  designation?: string | null;
  status: string;
  access_surface: string;
  client_surface?: string;
  organization: OrganizationBrief | null;
  roles?: RoleBrief[];
  permissions?: PermissionBrief[];
  mobile_eligible?: boolean;
}

export function orgLogin(companyCode: string, identifier: string, password: string) {
  const body: Record<string, string> = {
    company_code: companyCode.trim(),
    password,
    surface: 'mobile',
  };
  if (isEmail(identifier)) {
    body.personal_email = identifier.trim();
  } else {
    body.mobile = identifier.trim();
  }
  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body,
  });
}

export function getMe() {
  return apiRequest<MeResponse>('/auth/me');
}

export function orgForgotPassword(email: string, companyCode: string) {
  return apiRequest<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    auth: false,
    body: { email, company_code: companyCode },
  });
}

export function orgResetPassword(token: string, newPassword: string, confirmPassword: string) {
  return apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    auth: false,
    body: {
      token,
      new_password: newPassword,
      confirm_password: confirmPassword,
    },
  });
}

export function changePassword(data: {
  current_password: string;
  new_password: string;
  confirm_password: string;
}) {
  return apiRequest<{ message: string }>('/auth/change-password', {
    method: 'POST',
    body: data,
  });
}

export function updateProfile(data: { name?: string; mobile?: string | null; avatar_url?: string | null }) {
  return apiRequest<MeResponse>('/auth/me', {
    method: 'PATCH',
    body: data,
  });
}
