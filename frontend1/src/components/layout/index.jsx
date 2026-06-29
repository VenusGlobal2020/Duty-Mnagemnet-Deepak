import BaseLayout from './BaseLayout';
import {
  LayoutDashboard, Users, Shield, Star, Upload, UserCheck,
  ClipboardList, Settings, FileText, CalendarOff, Fingerprint,
  ScrollText, Unlock, Map,
  ArrowLeftRight,
} from 'lucide-react';

const JAIL_RIHAI_URL = 'https://criminal-dossier.stpepl.com/login';

// Items shared across every role's sidebar — placeholder modules + the external Jail Rihai link.
// `type: 'soon'` renders an in-app "coming soon" page. `type: 'external'` opens a new tab.
const extraNav = (base) => ([
  { to: `${base}/leave`, label: 'Leave Management', icon: CalendarOff, type: 'soon' },
  { to: `${base}/attendance`, label: 'Attendance', icon: Fingerprint, type: 'soon' },
  { to: `${base}/audit-log`, label: 'Audit Log', icon: ScrollText, type: 'soon' },
  { to: JAIL_RIHAI_URL, label: 'Jail Rihai', icon: Unlock, type: 'external' },
]);

// ─── Master Layout ─────────────────────────────────────────────────────────
const masterNav = [
  { to: '/master', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/master/superadmin', label: 'Superadmin (SP)', icon: Shield },
  { to: '/master/admins', label: 'Admins (ACP)', icon: Users },
  { to: '/master/ranks', label: 'Manage Ranks', icon: Star },
  { to: '/master/officers/bulk-upload', label: 'Bulk Upload Officers', icon: Upload },
  { to: '/master/officers', end: true, label: 'All Officers', icon: UserCheck },
  { to: '/master/map-view', label: 'Map View', icon: Map },
  ...extraNav('/master'),
  { to: '/master/settings', label: 'Settings', icon: Settings },
];
export function MasterLayout() { return <BaseLayout navItems={masterNav} />; }

// ─── Superadmin Layout ─────────────────────────────────────────────────────
const superadminNav = [
  { to: '/superadmin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/superadmin/admins', label: 'Admins (ACP)', icon: Users },
  { to: '/superadmin/duties', label: 'All Duties', icon: ClipboardList },
  { to: '/superadmin/map-view', label: 'Map View', icon: Map },
  ...extraNav('/superadmin'),
  { to: '/superadmin/settings', label: 'Settings', icon: Settings },
];
export function SuperadminLayout() { return <BaseLayout navItems={superadminNav} />; }

// ─── Admin Layout ─────────────────────────────────────────────────────────
const adminNav = [
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/operators', label: 'Operators', icon: Users },
  { to: '/admin/duties', label: 'All Duties', icon: ClipboardList },
  { to: '/admin/map-view', label: 'Map View', icon: Map },
  ...extraNav('/admin'),
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];
export function AdminLayout() { return <BaseLayout navItems={adminNav} />; }

// ─── Operator Layout ───────────────────────────────────────────────────────
const operatorNav = [
  { to: '/operator', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/operator/officers', label: 'Officers', icon: UserCheck },
  { to: '/operator/duties', label: 'Duties', icon: ClipboardList },
  { to: '/operator/map-view', label: 'Map View', icon: Map },
  ...extraNav('/operator'),
  { to: '/operator/swap-requests', label: 'Swap Requests', icon: ArrowLeftRight },
  { to: '/operator/settings', label: 'Settings', icon: Settings },
];
export function OperatorLayout() { return <BaseLayout navItems={operatorNav} />; }

// ─── Officer Layout ────────────────────────────────────────────────────────
const officerNav = [
  { to: '/officer', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/officer/duties', label: 'My Duties', icon: ClipboardList },
  { to: '/officer/history', label: 'Duty History', icon: FileText },
  { to: '/officer/map-view', label: 'Map View', icon: Map },
  ...extraNav('/officer'),
  { to: '/officer/settings', label: 'Settings', icon: Settings },
];
export function OfficerLayout() { return <BaseLayout navItems={officerNav} />; }
