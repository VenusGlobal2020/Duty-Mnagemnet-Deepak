import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Lock, Mail, ArrowRight, Landmark, Waves, MapPin, Compass } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiError } from '../../utils/helpers';
import toast from 'react-hot-toast';

// ── Mirzapur district reference data ──────────────────────────────────
// Tehsil / thana / area figures per district census records; SP name is
// intentionally left as a role line (not a person) since postings rotate —
// swap DISTRICT.spOfficer for the serving officer's name whenever you like.
const DISTRICT = {
  tehsils: '4',
  thanas: '16+',
  area: '4,521 वर्ग किमी',
  range: 'विंध्य परिक्षेत्र',
  spOfficer: null, // e.g. 'श्री XXXX, भा.पु.से.' — set this once confirmed
};

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const ROLE_PATHS = {
    master: '/master', superadmin: '/superadmin', admin: '/admin',
    operator_special: '/operator', operator_regular: '/operator', officer: '/officer',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('सभी फ़ील्ड आवश्यक हैं'); return; }
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`स्वागत है, ${user.name}!`);
      navigate(ROLE_PATHS[user.role] || '/login');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FBF7EF] dark:bg-ink-950">
      {/* ── Left panel — Mirzapur district identity ─────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[58%] relative flex-col justify-between overflow-hidden"
        style={{ background: 'linear-gradient(150deg, #241708 0%, #5B3013 32%, #B45F26 58%, #0C5866 100%)' }}
      >
        {/* Woven-thread border — nod to Mirzapur's GI-tagged carpet trade */}
        <svg className="absolute top-0 left-0 w-full h-2.5 opacity-70" preserveAspectRatio="none" viewBox="0 0 200 8">
          <defs>
            <pattern id="weave" width="10" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 8 L5 0 L10 8" fill="none" stroke="#F3D9AE" strokeWidth="1.4" />
            </pattern>
          </defs>
          <rect width="200" height="8" fill="url(#weave)" />
        </svg>

        {/* Soft dusk glow behind the ridgeline */}
        <div className="absolute top-10 right-16 w-72 h-72 rounded-full bg-amber-300/20 blur-3xl" />

        {/* Wordmark row */}
        <div className="relative z-10 flex items-center gap-3 px-12 pt-10">
          <div className="bracket-frame w-11 h-11 rounded-xl bg-white/10 border border-white/25 flex items-center justify-center backdrop-blur-sm text-white/70">
            <ShieldCheck className="w-6 h-6 text-white" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <span className="text-white font-display font-bold text-xl tracking-wide">मिर्ज़ापुर <span className="text-white/70">पुलिस</span></span>
            <p className="text-[11px] text-white/60 font-mono tracking-widest uppercase">ड्यूटी नियंत्रण कक्ष</p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 px-12 mt-2">
          <span className="glass-chip mb-5">
            <Compass className="w-3 h-3" /> विंध्य परिक्षेत्र · उत्तर प्रदेश पुलिस
          </span>
          <h1 className="text-4xl xl:text-[2.6rem] font-display font-bold text-white leading-[1.18] mb-4 tracking-tight">
            Duty & Leave Management<br />System
          </h1>
          <p className="text-white/80 text-base leading-relaxed max-w-md">
            विंध्याचल से चुनार तक फैले मिर्ज़ापुर जनपद में अधिकारियों की तैनाती, ड्यूटी की रीयल-टाइम ट्रैकिंग और हर असाइनमेंट का पूरा हिसाब — एक ही कमांड कंसोल से।
          </p>

          {/* District dossier strip — real administrative facts, not filler */}
          <div className="mt-8 grid grid-cols-4 gap-2.5 max-w-lg">
            {[
              { label: 'तहसील', value: DISTRICT.tehsils, icon: MapPin },
              { label: 'थाने', value: DISTRICT.thanas, icon: Landmark },
              { label: 'क्षेत्रफल', value: DISTRICT.area, icon: Compass },
              { label: 'परिक्षेत्र', value: DISTRICT.range, icon: ShieldCheck },
            ].map(item => (
              <div key={item.label} className="bracket-frame text-white/25 bg-white/10 border border-white/15 rounded-xl p-3 backdrop-blur-sm hover:bg-white/[0.14] transition-colors">
                <item.icon className="w-3.5 h-3.5 text-amber-200 mb-1.5" />
                <p className="text-white/55 text-[10px] font-mono uppercase tracking-wide leading-none">{item.label}</p>
                <p className="text-white font-semibold text-[13px] mt-1 leading-tight">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Vindhya ridgeline + Ganga illustration, anchored at the base */}
        <div className="relative z-10 mt-8">
          <svg viewBox="0 0 640 190" className="w-full h-auto block" preserveAspectRatio="none">
            <path d="M0,120 Q90,70 210,100 T460,80 T640,105 L640,190 L0,190 Z" fill="#2B1B12" opacity="0.45" />
            <path d="M0,148 Q130,100 280,130 T560,118 T640,138 L640,190 L0,190 Z" fill="#B45F26" opacity="0.55" />
            <path d="M0,168 Q160,140 300,160 T640,162 L640,190 L0,190 Z" fill="#241708" opacity="0.8" />
            {/* temple shikhara silhouette */}
            <g transform="translate(292,132)">
              <path d="M14,0 L20,26 L8,26 Z" fill="#1A1108" />
              <rect x="4" y="26" width="20" height="6" fill="#1A1108" />
              <rect x="0" y="32" width="28" height="6" fill="#1A1108" />
              <circle cx="14" cy="-3" r="2" fill="#1A1108" />
            </g>
            {/* Ganga */}
            <rect x="0" y="168" width="640" height="22" fill="#0C5866" />
            <path d="M0,176 Q80,171 160,176 T320,176 T480,176 T640,176" stroke="#7ED1DC" strokeWidth="1.2" fill="none" opacity="0.5" />
            <path d="M0,183 Q80,179 160,183 T320,183 T480,183 T640,183" stroke="#7ED1DC" strokeWidth="1" fill="none" opacity="0.35" />
          </svg>
        </div>

        <p className="relative z-10 px-12 pb-6 text-white/45 text-[11px] font-mono">
          {DISTRICT.spOfficer ? `पुलिस अधीक्षक — ${DISTRICT.spOfficer}` : 'पुलिस अधीक्षक कार्यालय, मिर्ज़ापुर'} · गोपनीय व्यवस्था
        </p>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative bg-[#FBF7EF] dark:bg-ink-950">
        <div
          className="absolute inset-0 lg:hidden"
          style={{ background: 'linear-gradient(150deg, #241708 0%, #5B3013 32%, #B45F26 58%, #0C5866 100%)' }}
        />

        <div className="relative w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-sm">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.25} />
            </div>
            <span className="font-display font-bold text-lg text-white">मिर्ज़ापुर <span className="text-white/70">पुलिस</span></span>
          </div>

          <div className="card shadow-panel p-7 lg:p-8 border-t-4 border-t-[#B45F26]">
            <div className="mb-7">
              <h2 className="text-2xl font-display font-bold text-ink-900 dark:text-white">
                वापसी पर स्वागत है
              </h2>
              <p className="text-ink-500 dark:text-ink-400 mt-1.5 text-sm">अपने कमांड डैशबोर्ड तक पहुंचने के लिए साइन इन करें</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">ईमेल पता</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    type="email"
                    className="input-field pl-10"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">पासवर्ड</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field pl-10 pr-10"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-sm text-[#0C5866] dark:text-signal2-400 hover:underline font-medium">
                  पासवर्ड भूल गए?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full justify-center py-2.5 group inline-flex items-center gap-2 rounded-xl font-semibold text-sm text-white
                           bg-gradient-to-b from-[#C2662B] to-[#9C4A1B] shadow-[0_8px_20px_-8px_rgba(180,95,38,0.55)]
                           hover:from-[#D97B3F] hover:to-[#B45F26] active:scale-[0.97] transition-all duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'साइन इन हो रहा है...' : 'साइन इन करें'}
                {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-ink-100 dark:border-ink-700 flex items-center gap-2 text-[11px] text-ink-400 dark:text-ink-500 font-mono">
              <Waves className="w-3.5 h-3.5 text-[#0C5866]" />
              सहायता हेतु: पुलिस नियंत्रण कक्ष, मिर्ज़ापुर
            </div>
          </div>

          <p className="text-center text-xs text-ink-400 dark:text-ink-500 mt-7 font-mono">
            {DISTRICT.spOfficer ? `पुलिस अधीक्षक कार्यालय — ${DISTRICT.spOfficer}` : 'पुलिस अधीक्षक कार्यालय, मिर्ज़ापुर'} · गोपनीय
          </p>
        </div>
      </div>
    </div>
  );
}