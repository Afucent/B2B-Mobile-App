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
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
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
  if (!values.code.trim()) errors.code = 'Code is required.';
  if (!values.annualDays.trim()) errors.annualDays = 'Annual days is required.';
  if (!values.status.trim()) errors.status = 'Status is required.';
  return errors;
}
