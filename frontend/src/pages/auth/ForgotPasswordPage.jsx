import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import api from '../../api/axios';
import { apiError } from '../../utils/helpers';
import toast from 'react-hot-toast';

const STEPS = { EMAIL: 'EMAIL', OTP: 'OTP', RESET: 'RESET', DONE: 'DONE' };

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const sendOTP = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Email required'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('OTP sent to your registered phone/email');
      setStep(STEPS.OTP);
    } catch (err) {
      toast.error(apiError(err));
    } finally { setLoading(false); }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) { toast.error('Enter 6-digit OTP'); return; }
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email, otp });
      toast.success('OTP verified');
      setStep(STEPS.RESET);
    } catch (err) {
      toast.error(apiError(err));
    } finally { setLoading(false); }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword, confirmPassword });
      toast.success('Password reset successfully!');
      setStep(STEPS.DONE);
    } catch (err) {
      toast.error(apiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white">DutyMgmt</span>
        </div>

        <div className="card p-6">
          {step === STEPS.EMAIL && (
            <>
              <h2 className="text-xl font-bold mb-1 dark:text-white">Forgot Password</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your email to receive an OTP.</p>
              <form onSubmit={sendOTP} className="space-y-4">
                <div>
                  <label className="form-label">Email Address</label>
                  <input type="email" className="input-field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">{loading ? 'Sending...' : 'Send OTP'}</button>
              </form>
            </>
          )}

          {step === STEPS.OTP && (
            <>
              <h2 className="text-xl font-bold mb-1 dark:text-white">Enter OTP</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">A 6-digit OTP was sent to your phone/email.</p>
              <form onSubmit={verifyOTP} className="space-y-4">
                <div>
                  <label className="form-label">OTP Code</label>
                  <input
                    type="text" maxLength={6} className="input-field text-center text-2xl tracking-widest font-bold"
                    placeholder="000000" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">{loading ? 'Verifying...' : 'Verify OTP'}</button>
                <button type="button" onClick={() => setStep(STEPS.EMAIL)} className="text-sm text-gray-500 hover:text-gray-700 w-full text-center">← Change email</button>
              </form>
            </>
          )}

          {step === STEPS.RESET && (
            <>
              <h2 className="text-xl font-bold mb-1 dark:text-white">Reset Password</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose a strong new password.</p>
              <form onSubmit={resetPassword} className="space-y-4">
                <div>
                  <label className="form-label">New Password</label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} className="input-field pr-10" placeholder="Min 8 characters" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="form-label">Confirm Password</label>
                  <input type="password" className="input-field" placeholder="Repeat password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">{loading ? 'Resetting...' : 'Reset Password'}</button>
              </form>
            </>
          )}

          {step === STEPS.DONE && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✅</span>
              </div>
              <h2 className="text-xl font-bold mb-2 dark:text-white">Password Reset!</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">You can now log in with your new password.</p>
              <Link to="/login" className="btn-primary justify-center">Go to Login</Link>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-gray-500 hover:text-primary-600 inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
