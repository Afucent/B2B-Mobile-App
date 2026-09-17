/** Generate a password that satisfies backend rules (upper, lower, digit, special). */
export function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  let password = [upper[0], lower[0], digits[0], special[0]].join('');
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

export function normalizeRoleKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

export function isDealerRoleName(name: string) {
  return normalizeRoleKey(name) === 'dealer';
}

/** Roles that can be assigned when creating/editing users (matches web). */
export function isAssignableRoleName(name: string) {
  const key = normalizeRoleKey(name);
  return (
    key !== 'tenant_member' &&
    key !== 'organization_admin' &&
    key !== 'platform_super_admin'
  );
}

export function isHiddenRoleName(name: string) {
  const key = normalizeRoleKey(name);
  return key === 'tenant_member' || key === 'platform_super_admin';
}
