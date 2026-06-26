import { useState } from 'react';
import { Eye, EyeOff, Lock, User, Save } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
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

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  const changePw = useMutation({
    mutationFn: (data) => api.patch('/auth/change-password', data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const handleChangePw = (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (pwForm.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    changePw.mutate(pwForm);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h1>

      {/* Profile card */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <User className="w-5 h-5 text-primary-600" />
          <h2 className="section-title">My Profile</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Full Name', value: user?.name },
            { label: 'Email', value: user?.email },
            { label: 'Phone', value: user?.phone },
            { label: 'Role', value: getRoleLabel(user?.role) },
            { label: 'Gender', value: user?.gender?.charAt(0).toUpperCase() + user?.gender?.slice(1) },
            { label: 'Account Status', value: user?.status?.toUpperCase() },
          ].map(item => (
            <div key={item.label}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{item.label}</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Change password card */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Lock className="w-5 h-5 text-primary-600" />
          <h2 className="section-title">Change Password</h2>
        </div>
        <form onSubmit={handleChangePw} className="space-y-4">
          <PasswordInput
            label="Current Password"
            placeholder="Enter current password"
            value={pwForm.currentPassword}
            show={showPw.current}
            onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
            onToggleShow={() => setShowPw(s => ({ ...s, current: !s.current }))}
          />
          <PasswordInput
            label="New Password"
            placeholder="Min 8 characters"
            value={pwForm.newPassword}
            show={showPw.new}
            onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
            onToggleShow={() => setShowPw(s => ({ ...s, new: !s.new }))}
          />
          <PasswordInput
            label="Confirm New Password"
            placeholder="Repeat new password"
            value={pwForm.confirmPassword}
            show={showPw.confirm}
            onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
            onToggleShow={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
          />
          <button type="submit" disabled={changePw.isPending} className="btn-primary">
            <Save className="w-4 h-4" />
            {changePw.isPending ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}