export type LeaveTypeFormValues = {
  name: string;
  code: string;
  annualDays: string;
  status: string;
  roleIds: string[];
};

export function emptyLeaveTypeForm(): LeaveTypeFormValues {
  return {
    name: '',
    code: '',
    annualDays: '',
    status: 'active',
    roleIds: [],
  };
}

export function toLeaveTypePayload(values: LeaveTypeFormValues) {
  const code = values.code.trim().toUpperCase();
  return {
    name: values.name.trim(),
    ...(code ? { code } : {}),
    category: 'annual',
    allocation_mode: 'fixed',
    annual_days: Number(values.annualDays),
    carry_forward: false,
    carry_forward_max: null,
    max_consecutive_days: null,
    encashable: false,
    status: values.status,
    role_ids: values.roleIds,
  };
}

export function validateLeaveTypeForm(values: LeaveTypeFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Name is required.';
  if (!values.annualDays.trim()) errors.annualDays = 'Annual days is required.';
  if (!values.status.trim()) errors.status = 'Status is required.';
  return errors;
}

export function leaveTypeToForm(item: {
  name?: string;
  code?: string | null;
  annual_days?: number | null;
  status?: string;
  role_ids?: string[];
}): LeaveTypeFormValues {
  return {
    name: item.name ?? '',
    code: item.code ?? '',
    annualDays: item.annual_days != null ? String(item.annual_days) : '',
    status: item.status === 'inactive' ? 'inactive' : 'active',
    roleIds: item.role_ids ?? [],
  };
}
