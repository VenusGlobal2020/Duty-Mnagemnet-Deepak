import BaseLayout from './BaseLayout';
import {
  LayoutDashboard, Users, Shield, Star, Upload, UserCheck,
  ClipboardList, Settings, FileText, CalendarOff, Fingerprint,
  ScrollText, Unlock, Map, Layers,
  ArrowLeftRight,
} from 'lucide-react';

const JAIL_RIHAI_URL = 'https://criminal-dossier.stpepl.com/login';

// Items shared across every role's sidebar — placeholder modules + the external Jail Rihai link.
// `type: 'soon'` renders an in-app "coming soon" page. `type: 'external'` opens a new tab.
const extraNav = (base) => ([
  { to: `${base}/leave`, label: 'अवकाश प्रबंधन', icon: CalendarOff, type: 'soon' },
  { to: `${base}/attendance`, label: 'उपस्थिति', icon: Fingerprint, type: 'soon' },
  { to: `${base}/audit-log`, label: 'ऑडिट लॉग', icon: ScrollText, type: 'soon' },
  { to: JAIL_RIHAI_URL, label: 'जेल रिहाई', icon: Unlock, type: 'external' },
]);

// ─── Master Layout ─────────────────────────────────────────────────────────
const masterNav = [
  { to: '/master', end: true, label: 'डैशबोर्ड', icon: LayoutDashboard },
  { to: '/master/superadmin', label: 'सुपरएडमिन (एसपी)', icon: Shield },
  { to: '/master/admins', label: 'एडमिन (एसीपी)', icon: Users },
  { to: '/master/ranks', label: 'रैंक प्रबंधन', icon: Star },
  { to: '/master/officers/bulk-upload', label: 'अधिकारी बल्क अपलोड', icon: Upload },
  { to: '/master/officers', end: true, label: 'सभी अधिकारी', icon: UserCheck },
  { to: '/master/map-view', label: 'मानचित्र दृश्य', icon: Map },
  ...extraNav('/master'),
  { to: '/master/settings', label: 'सेटिंग्स', icon: Settings },
];
export function MasterLayout() { return <BaseLayout navItems={masterNav} />; }

// ─── Superadmin Layout ─────────────────────────────────────────────────────
const superadminNav = [
  { to: '/superadmin', end: true, label: 'डैशबोर्ड', icon: LayoutDashboard },
  { to: '/superadmin/admins', label: 'एडमिन (एसीपी)', icon: Users },
  { to: '/superadmin/duties', label: 'सभी ड्यूटी', icon: ClipboardList },
  { to: '/superadmin/map-view', label: 'मानचित्र दृश्य', icon: Map },
  ...extraNav('/superadmin'),
  { to: '/superadmin/settings', label: 'सेटिंग्स', icon: Settings },
];
export function SuperadminLayout() { return <BaseLayout navItems={superadminNav} />; }

// ─── Admin Layout ─────────────────────────────────────────────────────────
const adminNav = [
  { to: '/admin', end: true, label: 'डैशबोर्ड', icon: LayoutDashboard },
  { to: '/admin/operators', label: 'ऑपरेटर', icon: Users },
  { to: '/admin/duties', label: 'सभी ड्यूटी', icon: ClipboardList },
  { to: '/admin/map-view', label: 'मानचित्र दृश्य', icon: Map },
  ...extraNav('/admin'),
  { to: '/admin/settings', label: 'सेटिंग्स', icon: Settings },
];
export function AdminLayout() { return <BaseLayout navItems={adminNav} />; }

// ─── Operator Layout ───────────────────────────────────────────────────────
const operatorNav = [
  { to: '/operator', end: true, label: 'डैशबोर्ड', icon: LayoutDashboard },
  { to: '/operator/officers', label: 'अधिकारी', icon: UserCheck },
  { to: '/operator/duties', label: 'ड्यूटी', icon: ClipboardList },
  { to: '/operator/duty-types', label: 'ड्यूटी प्रकार', icon: Layers },
  { to: '/operator/map-view', label: 'मानचित्र दृश्य', icon: Map },
  ...extraNav('/operator'),
  { to: '/operator/swap-requests', label: 'स्वैप अनुरोध', icon: ArrowLeftRight },
  { to: '/operator/settings', label: 'सेटिंग्स', icon: Settings },
];
export function OperatorLayout() { return <BaseLayout navItems={operatorNav} />; }

// ─── Officer Layout ────────────────────────────────────────────────────────
const officerNav = [
  { to: '/officer', end: true, label: 'डैशबोर्ड', icon: LayoutDashboard },
  { to: '/officer/duties', label: 'मेरी ड्यूटी', icon: ClipboardList },
  { to: '/officer/history', label: 'ड्यूटी इतिहास', icon: FileText },
  { to: '/officer/map-view', label: 'मानचित्र दृश्य', icon: Map },
  ...extraNav('/officer'),
  { to: '/officer/settings', label: 'सेटिंग्स', icon: Settings },
];
export function OfficerLayout() { return <BaseLayout navItems={officerNav} />; }