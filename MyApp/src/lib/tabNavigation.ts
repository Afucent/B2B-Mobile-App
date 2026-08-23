import type { Href } from 'expo-router';

import type { AdminNavContext } from '@/lib/adminNavigation';

export type AppTabName = 'index' | 'clock' | 'field' | 'roles' | 'profile';

export type TabNavLink = {
  title: string;
  subtitle?: string;
  href: Href;
  module: string;
  visible?: (ctx: AdminNavContext) => boolean;
};

export type TabNavSection = {
  title: string;
  links: TabNavLink[];
};

function filterLinks(links: TabNavLink[], ctx: AdminNavContext): TabNavLink[] {
  return links.filter((link) => {
    if (link.visible) return link.visible(ctx);
    return ctx.canView(link.module);
  });
}

const ROLES_LINKS: TabNavLink[] = [
  {
    title: 'Users',
    subtitle: 'Create and manage users',
    href: '/(admin)/users',
    module: 'users',
    visible: (ctx) => ctx.canView('users') || ctx.canCreate('users'),
  },
  {
    title: 'Role library',
    subtitle: 'Custom roles for your org',
    href: '/(admin)/roles',
    module: 'role_library',
  },
  {
    title: 'Permission matrix',
    subtitle: 'Web & mobile access per role',
    href: '/(admin)/roles/matrix',
    module: 'permission_matrix',
  },
  {
    title: 'Dealer assignment',
    subtitle: 'Assign dealers to field users',
    href: '/(admin)/users/dealer-assignments',
    module: 'dealers',
  },
];

const PROFILE_LINKS: TabNavLink[] = [
  {
    title: 'Organisation profile',
    href: '/(admin)/organization/profile',
    module: 'organization',
  },
];

const LEAVES_ADMIN_LINKS: TabNavLink[] = [
  {
    title: 'Leave types',
    href: '/(admin)/leave/types',
    module: 'leave_types',
    visible: (ctx) => ctx.canView('leave_types') || ctx.canManage('leave_types'),
  },
  {
    title: 'Leave requests',
    subtitle: 'Approve or reject requests',
    href: '/(admin)/leave/requests',
    module: 'leave_requests',
  },
  {
    title: 'Team calendar',
    href: '/(admin)/leave/calendar',
    module: 'team_calendar',
  },
  {
    title: 'Attendance dashboard',
    subtitle: 'Present, absent, on leave',
    href: '/(admin)/attendance',
    module: 'attendance',
  },
];

const FIELD_LINKS: TabNavLink[] = [
  {
    title: 'Visit assign',
    subtitle: 'Schedule dealer visits for employees',
    href: '/visit-assign',
    module: 'visit_assign',
    visible: (ctx) => ctx.canView('visit_assign') || ctx.canCreate('visit_assign'),
  },
  {
    title: 'Visit history',
    subtitle: 'Completed visits by employee',
    href: '/visit-history',
    module: 'visit_history',
  },
  {
    title: 'Live tracking',
    subtitle: 'Real-time map of field team',
    href: '/(admin)/live-tracking',
    module: 'live_location',
  },
  {
    title: 'Field ops settings',
    subtitle: 'Shift windows & geofence',
    href: '/(admin)/field-ops-settings',
    module: 'organization',
  },
  {
    title: 'Geography',
    subtitle: 'States, cities, regions, areas',
    href: '/(admin)/geography',
    module: 'geography',
  },
  {
    title: 'Dealers',
    subtitle: 'Dealer master list',
    href: '/(admin)/dealers',
    module: 'dealers',
  },
];

export function buildRolesTabSections(ctx: AdminNavContext): TabNavSection[] {
  const links = filterLinks(ROLES_LINKS, ctx);
  return links.length ? [{ title: 'Users & roles', links }] : [];
}

export function buildProfileTabSections(ctx: AdminNavContext): TabNavSection[] {
  const links = filterLinks(PROFILE_LINKS, ctx);
  return links.length ? [{ title: 'Organisation', links }] : [];
}

export function buildLeavesTabSections(ctx: AdminNavContext): TabNavSection[] {
  if (!ctx.fieldTrackingEnabled) return [];
  const links = filterLinks(LEAVES_ADMIN_LINKS, ctx);
  return links.length ? [{ title: 'Leave & attendance', links }] : [];
}

export function buildFieldTabSections(ctx: AdminNavContext): TabNavSection[] {
  if (!ctx.fieldTrackingEnabled) return [];
  const links = filterLinks(FIELD_LINKS, ctx);
  return links.length ? [{ title: 'Field operations', links }] : [];
}

type TabVisibilityContext = {
  isOrgAdmin: boolean;
  showMyAttendanceLeave: boolean;
  hasAnyAdminRead: boolean;
  canView: (module: string) => boolean;
  has: (module: string, action: string) => boolean;
  fieldTrackingEnabled: boolean;
};

export function getVisibleAppTabs(ctx: TabVisibilityContext): AppTabName[] {
  const tabs: AppTabName[] = ['index'];

  const showClock =
    ctx.showMyAttendanceLeave ||
    ctx.has('attendance', 'create') ||
    ctx.has('attendance', 'clock') ||
    ctx.has('leave_requests', 'create') ||
    ctx.has('my_attendance_leave', 'create');

  const showField =
    showClock ||
    ctx.canView('live_location') ||
    ctx.canView('geography') ||
    ctx.canView('dealers') ||
    ctx.canView('organization');

  if (showClock) tabs.push('clock');
  if (showField) tabs.push('field');
  if (canAccessRolesTab(ctx)) tabs.push('roles');
  tabs.push('profile');

  return tabs;
}

export function canAccessRolesTab(ctx: TabVisibilityContext): boolean {
  return (
    ctx.canView('users') ||
    ctx.has('users', 'create') ||
    ctx.canView('role_library') ||
    ctx.canView('permission_matrix') ||
    ctx.canView('dealers')
  );
}

export function canAccessLeaveManagement(ctx: TabVisibilityContext): boolean {
  return (
    ctx.fieldTrackingEnabled &&
    (ctx.canView('leave_types') ||
      ctx.canView('leave_requests') ||
      ctx.canView('team_calendar') ||
      ctx.canView('attendance'))
  );
}

export function canViewDashboard(ctx: TabVisibilityContext): boolean {
  return ctx.canView('dashboard') || ctx.isOrgAdmin || ctx.hasAnyAdminRead;
}
