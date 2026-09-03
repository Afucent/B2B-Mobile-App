import { apiRequest } from '@/lib/api/client';
import { isEmail } from '@/lib/format';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  must_change_password?: boolean;
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
  must_change_password?: boolean;
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

export function sendLoginOtp(companyCode: string, personalEmail: string) {
  return apiRequest<{ message: string }>('/auth/login-otp/send', {
    method: 'POST',
    auth: false,
    body: {
      company_code: companyCode.trim(),
      personal_email: personalEmail.trim(),
      surface: 'mobile',
    },
  });
}

export function verifyLoginOtp(companyCode: string, personalEmail: string, otp: string) {
  return apiRequest<TokenResponse>('/auth/login-otp/verify', {
    method: 'POST',
    auth: false,
    body: {
      company_code: companyCode.trim(),
      personal_email: personalEmail.trim(),
      otp: otp.trim(),
      surface: 'mobile',
    },
  });
}

export function setRequiredPassword(newPassword: string, confirmPassword: string) {
  return apiRequest<{ message: string }>('/auth/set-required-password', {
    method: 'POST',
    body: {
      new_password: newPassword,
      confirm_password: confirmPassword,
    },
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
