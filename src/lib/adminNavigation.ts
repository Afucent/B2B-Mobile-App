import type { Href } from 'expo-router';

export type AdminNavLink = {
  title: string;
  href: Href;
  module: string;
  visible?: (ctx: AdminNavContext) => boolean;
};

export type AdminNavSection = {
  title: string;
  links: AdminNavLink[];
};

export type AdminNavContext = {
  canView: (module: string) => boolean;
  canCreate: (module: string) => boolean;
  canManage: (module: string) => boolean;
  fieldTrackingEnabled: boolean;
};

const USERS_ROLES_LINKS: AdminNavLink[] = [
  {
    title: 'Users',
    href: '/(admin)/users',
    module: 'users',
    visible: (ctx) => ctx.canView('users') || ctx.canCreate('users'),
  },
  {
    title: 'Role library',
    href: '/(admin)/roles',
    module: 'role_library',
  },
  {
    title: 'Permission matrix',
    href: '/(admin)/roles/matrix',
    module: 'permission_matrix',
  },
  {
    title: 'Dealer assignment',
    href: '/(admin)/users/dealer-assignments',
    module: 'dealers',
  },
];

const FIELD_OPS_LINKS: AdminNavLink[] = [
  {
    title: 'Field ops settings',
    href: '/(admin)/field-ops-settings',
    module: 'organization',
  },
  {
    title: 'Live tracking',
    href: '/(admin)/live-tracking',
    module: 'live_location',
  },
  {
    title: 'Organisation profile',
    href: '/(admin)/organization/profile',
    module: 'organization',
  },
  {
    title: 'Organisation privacy',
    href: '/(admin)/organization/privacy',
    module: 'organization',
  },
];

const LEAVE_LINKS: AdminNavLink[] = [
  {
    title: 'Leave types',
    href: '/(admin)/leave/types',
    module: 'leave_types',
    visible: (ctx) => ctx.canView('leave_types') || ctx.canManage('leave_types'),
  },
  {
    title: 'Leave requests',
    href: '/(admin)/leave/requests',
    module: 'leave_requests',
  },
  {
    title: 'Team calendar',
    href: '/(admin)/leave/calendar',
    module: 'team_calendar',
  },
  {
    title: 'Attendance',
    subtitle: 'Clock in / clock out by day',
    href: '/(admin)/attendance',
    module: 'attendance',
  },
];

const COMMAND_LINKS: AdminNavLink[] = [
  {
    title: 'Dashboard',
    href: '/(admin)/dashboard',
    module: 'dashboard',
  },
];

function filterLinks(links: AdminNavLink[], ctx: AdminNavContext): AdminNavLink[] {
  return links.filter((link) => {
    if (link.visible) return link.visible(ctx);
    return ctx.canView(link.module);
  });
}

export function buildAdminNavigation(ctx: AdminNavContext): AdminNavSection[] {
  const sections: AdminNavSection[] = [];

  const command = filterLinks(COMMAND_LINKS, ctx);
  if (command.length > 0) {
    sections.push({ title: 'Command center', links: command });
  }

  const usersRoles = filterLinks(USERS_ROLES_LINKS, ctx);
  if (usersRoles.length > 0) {
    sections.push({ title: 'Users & roles', links: usersRoles });
  }

  if (ctx.fieldTrackingEnabled) {
    const fieldOps = filterLinks(FIELD_OPS_LINKS, ctx);
    if (fieldOps.length > 0) {
      sections.push({ title: 'Field operations', links: fieldOps });
    }

    const leave = filterLinks(LEAVE_LINKS, ctx);
    if (leave.length > 0) {
      sections.push({ title: 'Leave & attendance', links: leave });
    }
  }

  return sections;
}
