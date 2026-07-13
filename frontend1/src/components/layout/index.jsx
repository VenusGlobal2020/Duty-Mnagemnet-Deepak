import BaseLayout from './BaseLayout';
import {
  LayoutDashboard, Users, Shield, Star, Upload, UserCheck,
  ClipboardList, Settings, FileText, CalendarOff, Fingerprint,
  ScrollText, Unlock, Map, Layers,
  ArrowLeftRight, Siren,
} from 'lucide-react';

const JAIL_RIHAI_URL = 'https://criminal-dossier.stpepl.com/login';

// Items shared across every role's sidebar — placeholder modules + the external Jail Rihai link.
// `type: 'soon'` renders an in-app "coming soon" page. `type: 'external'` opens a new tab.

// ─── Master Layout ─────────────────────────────────────────────────────────
const masterNav = [
  { to: '/master', end: true, label: 'डैशबोर्ड', icon: LayoutDashboard },
  { to: '/master/superadmin', label: 'सुपरएडमिन', icon: Shield },
  { to: '/master/admins', label: 'एडमिन ', icon: Users },
  { to: '/master/ranks', label: 'रैंक प्रबंधन', icon: Star },
  { to: '/master/officers/bulk-upload', label: 'अधिकारी बल्क अपलोड', icon: Upload },
  { to: '/master/officers', end: true, label: 'सभी अधिकारी', icon: UserCheck },
  { to: '/master/map-view', label: 'मानचित्र दृश्य', icon: Map },
  // ...extraNav('/master'),
  { to: '/master/settings', label: 'सेटिंग्स', icon: Settings },
];
export function MasterLayout() { return <BaseLayout navItems={masterNav} />; }

// ─── Superadmin Layout ─────────────────────────────────────────────────────
const superadminNav = [
  { to: '/superadmin', end: true, label: 'डैशबोर्ड', icon: LayoutDashboard },
  { to: '/superadmin/admins', label: 'एडमिन (एसीपी)', icon: Users },
  { to: '/superadmin/officers', label: 'सभी अधिकारी', icon: UserCheck },
  { to: '/superadmin/officers/bulk-upload', label: 'अधिकारी बल्क अपलोड', icon: Upload },
  { to: '/superadmin/duties', label: 'सभी ड्यूटी', icon: ClipboardList },
  { to: '/superadmin/map-view', label: 'मानचित्र दृश्य', icon: Map },
  { to: '/superadmin/leave', label: 'अवकाश प्रबंधन', icon: CalendarOff },
  { to: '/superadmin/emergency', label: 'आपातकालीन लॉकडाउन', icon: Siren },
  // ...extraNav('/superadmin'),
  { to: '/superadmin/settings', label: 'सेटिंग्स', icon: Settings },
];
export function SuperadminLayout() { return <BaseLayout navItems={superadminNav} />; }

// ─── Admin Layout ─────────────────────────────────────────────────────────
const adminNav = [
  { to: '/admin', end: true, label: 'डैशबोर्ड', icon: LayoutDashboard },
  { to: '/admin/operators', label: 'ऑपरेटर', icon: Users },
  { to: '/admin/officers', label: 'अधिकारी', icon: UserCheck },
  { to: '/admin/duties', label: 'सभी ड्यूटी', icon: ClipboardList },
  { to: '/admin/map-view', label: 'मानचित्र दृश्य', icon: Map },
  { to: '/admin/leave', label: 'अवकाश प्रबंधन', icon: CalendarOff },
  // ...extraNav('/admin'),
  { to: '/admin/settings', label: 'सेटिंग्स', icon: Settings },
];
export function AdminLayout() { return <BaseLayout navItems={adminNav} />; }

// ─── Operator Layout ───────────────────────────────────────────────────────
const operatorNav = [
  { to: '/operator', end: true, label: 'डैशबोर्ड', icon: LayoutDashboard },
  { to: '/operator/officers', label: 'अधिकारी', icon: UserCheck },
  { to: '/operator/duties', label: 'ड्यूटी', icon: ClipboardList },
  { to: '/operator/duties/bulk-upload', label: 'ड्यूटी बल्क अपलोड', icon: Upload },
  { to: '/operator/duty-types', label: 'ड्यूटी प्रकार', icon: Layers },
  { to: '/operator/map-view', label: 'मानचित्र दृश्य', icon: Map },
  { to: '/operator/leave', label: 'अवकाश प्रबंधन', icon: CalendarOff },
  // ...extraNav('/operator'),
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
  { to: '/officer/leave', label: 'अवकाश प्रबंधन', icon: CalendarOff },
  // ...extraNav('/officer'),
  { to: '/officer/settings', label: 'सेटिंग्स', icon: Settings },
];
export function OfficerLayout() { return <BaseLayout navItems={officerNav} />; }