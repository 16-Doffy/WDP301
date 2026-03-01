import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';

const AnnotatorOverview = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0, overdue: 0 });
  const [penalties, setPenalties] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qualityScore, setQualityScore] = useState(100);
  const navigate = useNavigate();

  const userId = user?._id || user?.id;

  useEffect(() => {
    const fetchData = async () => {
      if (!userId) {
        setError('Không xác định được tài khoản hiện tại. Vui lòng đăng xuất và đăng nhập lại.');
        setLoading(false);
        return;
      }

      try {
        const [tasksRes, penaltiesRes, rewardsRes, scoreRes] = await Promise.all([
          axios.get(`${API_URL}/api/tasks/my-tasks`),
          axios.get(`${API_URL}/api/penalties/user/${userId}`),
          axios.get(`${API_URL}/api/penalties/rewards/${userId}`),
          axios.get(`${API_URL}/api/penalties/score/${userId}`),
        ]);

        const tasks = tasksRes.data || [];
        const now = new Date();
        const total = tasks.length;
        const completed = tasks.filter((t) => t.status === 'approved').length;
        const inProgress = tasks.filter((t) => t.status === 'in_progress' || t.status === 'submitted' || t.status === 'rejected').length;
        const overdue = tasks.filter((t) => t.projectId?.deadline && new Date(t.projectId.deadline) < now && t.status !== 'approved').length;

        setStats({ total, completed, inProgress, overdue });
        setPenalties((penaltiesRes.data || []).slice(0, 6));
        setRewards((rewardsRes.data || []).slice(0, 6));
        setQualityScore(Number(scoreRes?.data?.qualityScore ?? 100));
      } catch (err) {
        if (err.response?.status === 403) {
          setError('Bạn không có quyền truy cập dữ liệu. Vui lòng đăng nhập đúng tài khoản Annotator hoặc liên hệ Manager.');
        } else {
          setError(err.response?.data?.message || 'Không tải được dữ liệu dashboard. Vui lòng thử lại sau.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const totals = useMemo(() => {
    const totalPenalty = penalties.reduce((sum, p) => sum + (Number(p.scoreDeduction) || 0), 0);
    const totalReward = rewards.reduce((sum, r) => sum + (Number(r.scoreBonus) || 0), 0);
    return { totalPenalty, totalReward };
  }, [penalties, rewards]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const qualityScoreDisplay = Number.isFinite(qualityScore) ? qualityScore : 100;
  const qualityScoreColor =
    qualityScoreDisplay >= 80 ? 'text-emerald-300' : qualityScoreDisplay >= 60 ? 'text-amber-300' : 'text-rose-300';

  const cards = [
    { title: 'TOTAL TASKS', value: stats.total, hint: 'All assigned tasks', accent: 'from-sky-400 to-blue-500' },
    { title: 'IN PROGRESS', value: stats.inProgress, hint: 'Working / needs revision', accent: 'from-amber-400 to-orange-500' },
    { title: 'COMPLETED', value: stats.completed, hint: 'Approved tasks', accent: 'from-emerald-400 to-green-500' },
    { title: 'OVERDUE', value: stats.overdue, hint: 'Past project deadline', accent: 'from-rose-400 to-pink-500' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="rounded-[28px] p-6 md:p-8 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 shadow-[0_30px_80px_rgba(0,0,0,0.28)] border border-white/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.25),transparent_50%),radial-gradient(circle_at_85%_30%,rgba(255,255,255,0.18),transparent_45%)] pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Hello, Annotator</h1>
            <p className="mt-1 text-white/80">Overview of your task workload and progress.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-white/15 border border-white/30 text-white">
              <p className="text-[11px] uppercase tracking-wider text-white/75 font-bold">Quality Score</p>
              <p className={`text-xl font-extrabold leading-tight ${qualityScoreColor}`}>{qualityScoreDisplay.toFixed(1)}</p>
            </div>
            <button
              onClick={() => navigate('/annotator/tasks')}
              className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold transition-colors"
            >
              OPEN MY TASKS
            </button>
          </div>
        </div>

        {error && (
          <div className="relative mt-6 rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-rose-700 text-sm">
            {error}
          </div>
        )}

        <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <button
              key={c.title}
              type="button"
              onClick={() => navigate('/annotator/tasks')}
              className="text-left rounded-2xl p-4 bg-white/10 border border-white/25 backdrop-blur-md text-white hover:bg-white/15 transition-colors"
            >
              <p className="text-xs tracking-wider font-bold text-white/80">{c.title}</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">{c.value}</p>
              <div className={`mt-3 h-1.5 rounded-full bg-gradient-to-r ${c.accent}`} />
              <p className="mt-2 text-xs text-white/75">{c.hint}</p>
            </button>
          ))}
        </div>

        <div className="relative mt-6 rounded-2xl p-5 bg-white/10 border border-white/25 backdrop-blur-md text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Next step</h2>
            <p className="text-sm text-white/80 mt-1">Continue labeling the most relevant task in your queue.</p>
          </div>
          <button
            onClick={() => navigate('/annotator/tasks')}
            className="px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 border border-white/30 font-semibold"
          >
            GO TO MY TASKS
          </button>
        </div>

        <div className="relative mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5 bg-white/10 border border-white/25 backdrop-blur-md text-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Điểm phạt từ Manager</h3>
              <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-bold">
                -{totals.totalPenalty} điểm
              </span>
            </div>

            {penalties.length === 0 ? (
              <p className="text-sm text-white/80">Hiện chưa có penalty nào.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {penalties.map((p) => (
                  <div key={p._id} className="rounded-xl border border-white/20 bg-white/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white capitalize">{p.level || 'penalty'}</span>
                      <span className="text-xs font-bold text-rose-200">-{p.scoreDeduction || 0} điểm</span>
                    </div>
                    <p className="mt-1 text-sm text-white/85">{p.reason || 'Không có mô tả lý do.'}</p>
                    <p className="mt-1 text-xs text-white/65">{new Date(p.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl p-5 bg-white/10 border border-white/25 backdrop-blur-md text-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Điểm thưởng từ Manager</h3>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                +{totals.totalReward} điểm
              </span>
            </div>

            {rewards.length === 0 ? (
              <p className="text-sm text-white/80">Hiện chưa có reward nào.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {rewards.map((r) => (
                  <div key={r._id} className="rounded-xl border border-white/20 bg-white/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white capitalize">{r.type || 'reward'}</span>
                      <span className="text-xs font-bold text-emerald-200">+{r.scoreBonus || 0} điểm</span>
                    </div>
                    <p className="mt-1 text-sm text-white/85">{r.reason || 'Không có mô tả lý do.'}</p>
                    <p className="mt-1 text-xs text-white/65">{new Date(r.createdAt).toLocaleString('vi-VN')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotatorOverview;
