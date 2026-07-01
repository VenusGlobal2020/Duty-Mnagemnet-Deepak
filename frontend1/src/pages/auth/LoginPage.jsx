import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, Lock, Mail, ArrowRight, Radar, Activity, Key } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiError } from '../../utils/helpers';
import toast from 'react-hot-toast';

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
    <div className="min-h-screen flex bg-ink-100 dark:bg-ink-950">
      {/* ── Left panel — command-center branding ───────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-12 bg-ink-950 overflow-hidden">
        {/* Backdrop layers — grid + radial glow + scanline, the signature look */}
        <div className="absolute inset-0 grid-backdrop opacity-60" />
        <div className="absolute -top-32 -left-20 w-[34rem] h-[34rem] rounded-full bg-signal2-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[26rem] h-[26rem] rounded-full bg-signal-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />
        <div className="absolute left-0 top-0 w-full h-px overflow-hidden opacity-40">
          <div className="w-full h-24 bg-gradient-to-b from-signal2-400/40 to-transparent animate-scanline" />
        </div>

        {/* Logo row */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-signal-400 to-signal-600 flex items-center justify-center shadow-glow-signal">
            <Shield className="w-6 h-6 text-ink-950" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <span className="text-white font-display font-bold text-xl tracking-wide">DUTY<span className="text-signal-400">OPS</span></span>
            <p className="text-[11px] text-ink-400 font-mono tracking-widest uppercase">कमांड कंसोल</p>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-signal2-300 bg-signal2-400/10 border border-signal2-400/25 rounded-full px-3 py-1 mb-6">
            <Activity className="w-3 h-3" /> लाइव ऑपरेशन
          </span>
          <h1 className="text-4xl xl:text-[2.75rem] font-display font-bold text-white leading-[1.15] mb-4 tracking-tight">
            पुलिस ड्यूटी<br />प्रबंधन प्रणाली
          </h1>
          <p className="text-ink-300 text-base leading-relaxed max-w-md">
            अधिकारियों की तैनाती करें, ड्यूटी को रीयल टाइम में ट्रैक करें, और हर असाइनमेंट को जवाबदेह बनाए रखें — वीवीआईपी ड्यूटी से लेकर सिटी-पॉइंट गश्त तक।
          </p>

          <div className="mt-9 grid grid-cols-2 gap-3 max-w-md">
            {[
              { label: 'ड्यूटी प्रकार', value: 'वीवीआईपी · सिटी · क्रिमिनल', icon: Radar },
              { label: 'भूमिका-आधारित पहुंच', value: '5 कमांड स्तर', icon: Key },
              { label: 'लाइव अलर्ट', value: 'पुश + व्हाट्सएप', icon: Activity },
              { label: 'सुरक्षा', value: 'JWT + रिफ्रेश', icon: Shield },
            ].map(item => (
              <div key={item.label} className="bracket-frame text-signal2-400/40 bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5 backdrop-blur-sm">
                <item.icon className="w-3.5 h-3.5 text-signal2-400 mb-2" />
                <p className="text-ink-400 text-[11px] font-mono uppercase tracking-wide">{item.label}</p>
                <p className="text-white font-semibold text-sm mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-ink-500 text-xs font-mono">© {new Date().getFullYear()} पुलिस ड्यूटी प्रबंधन प्रणाली — गोपनीय</p>
      </div>

      {/* ── Right panel — form ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 lg:hidden bg-ink-950" />
        <div className="absolute inset-0 lg:hidden grid-backdrop opacity-50" />

        <div className="relative w-full max-w-md">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-signal-400 to-signal-600 flex items-center justify-center shadow-glow-signal">
              <Shield className="w-5 h-5 text-ink-950" strokeWidth={2.25} />
            </div>
            <span className="font-display font-bold text-lg text-white">DUTY<span className="text-signal-400">OPS</span></span>
          </div>

          <div className="card lg:shadow-panel p-7 lg:p-8 dark:bg-ink-900/95 lg:border lg:border-ink-200/70 dark:lg:border-white/[0.06]">
            <div className="mb-7">
              <h2 className="text-2xl font-display font-bold text-ink-900 dark:text-white lg:text-ink-900">
                <span className="dark:text-white">वापसी पर स्वागत है</span>
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
                <Link to="/forgot-password" className="text-sm text-signal2-600 dark:text-signal2-400 hover:underline font-medium">
                  पासवर्ड भूल गए?
                </Link>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 group">
                {loading ? 'साइन इन हो रहा है...' : 'साइन इन करें'}
                {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-ink-400 dark:text-ink-500 mt-7 font-mono">
            पुलिस ड्यूटी प्रबंधन प्रणाली — गोपनीय
          </p>
        </div>
      </div>
    </div>
  );
}
