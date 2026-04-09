import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ProfileModal = ({ open, onClose, user }) => {
  const [tab, setTab] = useState('info');
  const [form, setForm] = useState({ fullName: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user && open) {
      setForm({ fullName: user.fullName || '' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setError('');
      setSuccess('');
      setTab('info');
    }
  }, [user, open]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handlePasswordChange = (e) => setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) { setError('Ho ten khong duoc de trong'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName: form.fullName }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message || 'Loi he thong');
      else {
        setSuccess('Cap nhat thanh cong!');
        const stored = sessionStorage.getItem('user') || localStorage.getItem('user');
        if (stored) {
          const updated = { ...JSON.parse(stored), fullName: data.fullName };
          if (sessionStorage.getItem('token')) sessionStorage.setItem('user', JSON.stringify(updated));
          if (localStorage.getItem('token')) localStorage.setItem('user', JSON.stringify(updated));
          window.dispatchEvent(new CustomEvent('userProfileUpdated', { detail: updated }));
        }
        setTimeout(() => setSuccess(''), 2000);
      }
    } catch { setError('Loi ket noi server'); }
    finally { setLoading(false); }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    if (!currentPassword) { setError('Vui long nhap mat khau hien tai'); return; }
    if (!newPassword) { setError('Vui long nhap mat khau moi'); return; }
    if (newPassword.length < 6) { setError('Mat khau moi phai it nhat 6 ky tu'); return; }
    if (newPassword !== confirmPassword) { setError('Mat khau moi khong khop'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const res = await fetch(`${API_URL}/users/me/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message || 'Loi he thong');
      else {
        setSuccess('Doi mat khau thanh cong!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setSuccess(''), 2000);
      }
    } catch { setError('Loi ket noi server'); }
    finally { setLoading(false); }
  };

  const roleColors = { admin: 'text-rose-400', manager: 'text-amber-400', reviewer: 'text-violet-400', annotator: 'text-blue-400' };
  const roleLabels = { admin: 'Admin', manager: 'Manager', reviewer: 'Reviewer', annotator: 'Annotator' };
  const roleBgColors = {
    admin: 'bg-rose-500/10 border-rose-500/30',
    manager: 'bg-amber-500/10 border-amber-500/30',
    reviewer: 'bg-violet-500/10 border-violet-500/30',
    annotator: 'bg-blue-500/10 border-blue-500/30',
  };
  const initials = user?.fullName ? user.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : (user?.username?.[0]?.toUpperCase() || 'U');
  const roleColorClass = roleColors[user?.role] || 'text-gray-400';
  const roleBgClass = roleBgColors[user?.role] || 'bg-gray-500/10 border-gray-500/30';

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', borderRadius: '16px' } }}>
      <DialogTitle sx={{ fontSize: '16px', fontWeight: 700, borderBottom: '1px solid #334155', pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        Thong tin ca nhan
      </DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <div className="flex flex-col items-center mb-5">
          <div className="w-20 h-20 rounded-full bg-violet-600 border-4 border-gray-700 flex items-center justify-center text-2xl font-bold text-white mb-3">{initials}</div>
          <h3 className="text-base font-semibold text-gray-100">{user?.fullName || user?.username}</h3>
          <span className={`mt-1 text-[11px] uppercase tracking-wider font-semibold px-3 py-0.5 rounded-full border ${roleBgClass} ${roleColorClass}`}>{roleLabels[user?.role] || user?.role}</span>
        </div>
        <div className="flex rounded-lg bg-gray-800/60 border border-gray-700/50 p-1 mb-5">
          <button onClick={() => { setTab('info'); setError(''); setSuccess(''); }} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${tab === 'info' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Thong tin</button>
          <button onClick={() => { setTab('password'); setError(''); setSuccess(''); }} className={`flex-1 py-2 text-xs font-semibold rounded-md transition-colors ${tab === 'password' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>Doi mat khau</button>
        </div>
        {tab === 'info' && (
          <form onSubmit={handleInfoSubmit} className="space-y-3">
            <div className="rounded-lg bg-gray-800/60 border border-gray-700/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Username</p>
              <p className="text-sm text-gray-200">{user?.username}</p>
            </div>
            <div className="rounded-lg bg-gray-800/60 border border-gray-700/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Email</p>
              <p className="text-sm text-gray-200">{user?.email}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Email khong the thay doi</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Ho va ten <span className="text-rose-400">*</span></label>
              <input type="text" name="fullName" value={form.fullName} onChange={handleChange} disabled={loading}
                className="w-full rounded-lg bg-gray-800 border border-gray-600/50 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="Nhap ho va ten..." />
            </div>
            {error && <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5"><p className="text-xs text-rose-400">{error}</p></div>}
            {success && <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5"><p className="text-xs text-emerald-400">{success}</p></div>}
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {loading ? 'Dang luu...' : 'Luu thong tin'}
            </button>
          </form>
        )}
        {tab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Mat khau hien tai</label>
              <input type="password" name="currentPassword" value={passwordForm.currentPassword} onChange={handlePasswordChange} disabled={loading}
                className="w-full rounded-lg bg-gray-800 border border-gray-600/50 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="Nhap mat khau hien tai..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Mat khau moi</label>
              <input type="password" name="newPassword" value={passwordForm.newPassword} onChange={handlePasswordChange} disabled={loading}
                className="w-full rounded-lg bg-gray-800 border border-gray-600/50 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="It nhat 6 ky tu..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Xac nhan mat khau moi</label>
              <input type="password" name="confirmPassword" value={passwordForm.confirmPassword} onChange={handlePasswordChange} disabled={loading}
                className="w-full rounded-lg bg-gray-800 border border-gray-600/50 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                placeholder="Nhap lai mat khau moi..." />
            </div>
            {error && <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5"><p className="text-xs text-rose-400">{error}</p></div>}
            {success && <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5"><p className="text-xs text-emerald-400">{success}</p></div>}
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-50">
              {loading ? 'Dang xu ly...' : 'Doi mat khau'}
            </button>
          </form>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, borderTop: '1px solid #334155', pt: 2 }}>
        <button onClick={onClose} disabled={loading} className="flex-1 rounded-lg bg-gray-700 hover:bg-gray-600 px-4 py-2.5 text-sm font-semibold text-gray-300 transition-colors disabled:opacity-50">Dong</button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfileModal;