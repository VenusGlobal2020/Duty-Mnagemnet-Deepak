import BaseLayout from './BaseLayout';
import {
  LayoutDashboard, Users, Shield, Star, Upload, UserCheck,
  ClipboardList, Settings, Eye, FileText
} from 'lucide-react';

// ─── Master Layout ─────────────────────────────────────────────────────────
const masterNav = [
  { to: '/master', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/master/superadmin', label: 'Superadmin (SP)', icon: Shield },
  { to: '/master/admins', label: 'Admins (ACP)', icon: Users },
  { to: '/master/ranks', label: 'Manage Ranks', icon: Star },
  { to: '/master/officers/bulk-upload', label: 'Bulk Upload Officers', icon: Upload },
  { to: '/master/officers', end: true, label: 'All Officers', icon: UserCheck },
  { to: '/master/settings', label: 'Settings', icon: Settings },
];
export function MasterLayout() { return <BaseLayout navItems={masterNav} />; }

// ─── Superadmin Layout ─────────────────────────────────────────────────────
const superadminNav = [
  { to: '/superadmin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/superadmin/admins', label: 'Admins (ACP)', icon: Users },
  { to: '/superadmin/duties', label: 'All Duties', icon: ClipboardList },
  { to: '/superadmin/settings', label: 'Settings', icon: Settings },
];
export function SuperadminLayout() { return <BaseLayout navItems={superadminNav} />; }

// ─── Admin Layout ─────────────────────────────────────────────────────────
const adminNav = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/operators', label: 'Operators', icon: Users },
  { to: '/admin/duties', label: 'All Duties', icon: ClipboardList },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];
export function AdminLayout() { return <BaseLayout navItems={adminNav} />; }

// ─── Operator Layout ───────────────────────────────────────────────────────
const operatorNav = [
  { to: '/operator', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/operator/officers', label: 'Officers', icon: UserCheck },
  { to: '/operator/duties', label: 'Duties', icon: ClipboardList },
  { to: '/operator/settings', label: 'Settings', icon: Settings },
];
export function OperatorLayout() { return <BaseLayout navItems={operatorNav} />; }

// ─── Officer Layout ────────────────────────────────────────────────────────
const officerNav = [
  { to: '/officer', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/officer/duties', label: 'My Duties', icon: ClipboardList },
  { to: '/officer/history', label: 'Duty History', icon: FileText },
  { to: '/officer/settings', label: 'Settings', icon: Settings },
];
export function OfficerLayout() { return <BaseLayout navItems={officerNav} />; }