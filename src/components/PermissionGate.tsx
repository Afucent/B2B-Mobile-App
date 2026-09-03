import type { ReactNode } from 'react';

import { usePermissions } from '@/hooks/usePermissions';

type GateAction = 'read' | 'create' | 'update' | 'delete';

type Props = {
  module: string;
  action?: GateAction;
  allowCreate?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
};

export default function PermissionGate({
  module,
  action = 'read',
  allowCreate = false,
  fallback = null,
  children,
}: Props) {
  const { canView, canCreate, canEdit, canDelete } = usePermissions();

  const allowed = (() => {
    if (action === 'read') {
      if (canView(module)) return true;
      if (allowCreate && canCreate(module)) return true;
      return false;
    }
    if (action === 'create') return canCreate(module);
    if (action === 'update') return canEdit(module);
    return canDelete(module);
  })();

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
