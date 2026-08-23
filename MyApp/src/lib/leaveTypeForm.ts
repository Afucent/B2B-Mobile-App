export type LeaveTypeFormValues = {
  name: string;
  code: string;
  category: 'annual' | 'sick' | 'other';
  annualDays: string;
  carryForward: boolean;
  carryForwardMax: string;
  encashable: boolean;
  status: string;
  roleIds: string[];
};

export function emptyLeaveTypeForm(): LeaveTypeFormValues {
  return {
    name: '',
    code: '',
    category: 'annual',
    annualDays: '',
    carryForward: false,
    carryForwardMax: '',
    encashable: false,
    status: 'active',
    roleIds: [],
  };
}

export function toLeaveTypePayload(values: LeaveTypeFormValues) {
  return {
    name: values.name.trim(),
    code: values.code.trim().toUpperCase(),
    category: values.category,
    allocation_mode: 'fixed',
    annual_days: Number(values.annualDays),
    carry_forward: values.carryForward,
    carry_forward_max: values.carryForward ? Number(values.carryForwardMax) : null,
    max_consecutive_days: null,
    encashable: values.encashable,
    status: values.status,
    role_ids: values.roleIds,
  };
}

export function validateLeaveTypeForm(values: LeaveTypeFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.name.trim()) errors.name = 'Name is required.';
  if (!values.code.trim()) errors.code = 'Code is required.';
  if (!values.annualDays.trim()) errors.annualDays = 'Annual days is required.';
  if (values.carryForward && !values.carryForwardMax.trim()) {
    errors.carryForwardMax = 'Max carry forward days is required.';
  }
  return errors;
}
