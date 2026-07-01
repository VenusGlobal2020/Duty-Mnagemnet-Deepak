import { useState } from 'react';
import { Eye, EyeOff, Lock, User, Save, Languages, Check } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import { useTypingMode } from '../../contexts/TypingModeContext';
import { apiError, getRoleLabel } from '../../utils/helpers';
import toast from 'react-hot-toast';

// Defined OUTSIDE SettingsPage so its identity stays stable across re-renders.
// Previously this was declared inside SettingsPage's body, which meant a brand
// new component type was created on every render. React saw that as a totally
// different component each keystroke and remounted the underlying <input>,
// which kicked focus out of the field after every character typed.
function PasswordInput({ label, placeholder, value, show, onChange, onToggleShow }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className="input-field pr-10"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

const TYPING_MODES = [
  { id: 'mangal', label: 'हिंदी (मंगल / यूनिकोड)', hint: 'सामान्य हिंदी की-बोर्ड से टाइप करें' },
  { id: 'krutidev', label: 'हिंदी (कृतिदेव)', hint: 'कृतिदेव लेआउट में टाइप करें, अपने आप यूनिकोड में बदलेगा' },
  { id: 'english', label: 'English', hint: 'सामान्य अंग्रेज़ी टाइपिंग' },
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { mode, setMode } = useTypingMode();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  const changePw = useMutation({
    mutationFn: (data) => api.patch('/auth/change-password', data),
    onSuccess: () => {
      toast.success('पासवर्ड सफलतापूर्वक बदला गया');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const handleChangePw = (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('पासवर्ड मेल नहीं खा रहे'); return; }
    if (pwForm.newPassword.length < 8) { toast.error('पासवर्ड कम से कम 8 अक्षर का होना चाहिए'); return; }
    changePw.mutate(pwForm);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">सेटिंग्स</h1>

      {/* Profile card */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <User className="w-5 h-5 text-primary-600" />
          <h2 className="section-title">मेरी प्रोफ़ाइल</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'पूरा नाम', value: user?.name },
            { label: 'ईमेल', value: user?.email },
            { label: 'फ़ोन', value: user?.phone },
            { label: 'भूमिका', value: getRoleLabel(user?.role) },
            { label: 'लिंग', value: user?.gender?.charAt(0).toUpperCase() + user?.gender?.slice(1) },
            { label: 'खाता स्थिति', value: user?.status?.toUpperCase() },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{item.label}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Typing mode preference */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Languages className="w-5 h-5 text-primary-600" />
          <h2 className="section-title">टाइपिंग मोड</h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          यह चुनाव पूरे सिस्टम के टेक्स्ट फ़ील्ड्स में लागू होगा। किसी भी फ़ील्ड के अंदर मौजूद बटन से भी तुरंत बदला जा सकता है।
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TYPING_MODES.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`relative text-left p-3 rounded-lg border-2 transition-colors ${
                mode === m.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
              }`}
            >
              {mode === m.id && (
                <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </span>
              )}
              <p className={`text-sm font-semibold text-gray-900 dark:text-white ${m.id !== 'english' ? 'font-hindi' : ''}`}>{m.label}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{m.hint}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Change password card */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Lock className="w-5 h-5 text-primary-600" />
          <h2 className="section-title">पासवर्ड बदलें</h2>
        </div>
        <form onSubmit={handleChangePw} className="space-y-4">
          <PasswordInput
            label="वर्तमान पासवर्ड"
            placeholder="वर्तमान पासवर्ड दर्ज करें"
            value={pwForm.currentPassword}
            show={showPw.current}
            onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
            onToggleShow={() => setShowPw(s => ({ ...s, current: !s.current }))}
          />
          <PasswordInput
            label="नया पासवर्ड"
            placeholder="कम से कम 8 अक्षर"
            value={pwForm.newPassword}
            show={showPw.new}
            onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
            onToggleShow={() => setShowPw(s => ({ ...s, new: !s.new }))}
          />
          <PasswordInput
            label="नया पासवर्ड फिर से लिखें"
            placeholder="नया पासवर्ड दोबारा दर्ज करें"
            value={pwForm.confirmPassword}
            show={showPw.confirm}
            onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
            onToggleShow={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
          />
          <button type="submit" disabled={changePw.isPending} className="btn-primary">
            <Save className="w-4 h-4" />
            {changePw.isPending ? 'सहेजा जा रहा है...' : 'पासवर्ड अपडेट करें'}
          </button>
        </form>
      </div>
    </div>
  );
}
