import React from 'react';
import { useNavigate } from 'react-router-dom';

const AnnotatorRules = () => {
  const navigate = useNavigate();

  const penaltyLevels = [
    {
      level: 'Warning',
      score: '-2 điểm',
      when: 'Thường áp dụng khi bị reject lần 2 trong 7 ngày',
      action: 'Bắt đọc guideline / Thông báo',
      color: 'from-amber-300/35 to-orange-300/20 border-amber-200/40',
      chipBg: 'bg-amber-100 text-amber-800',
    },
    {
      level: 'Light',
      score: '-5 điểm',
      when: 'Thường áp dụng khi bị reject từ 3 lần trong 7 ngày hoặc đã có penalty Light gần đây',
      action: 'Giảm số task/tuần',
      color: 'from-sky-300/35 to-blue-300/20 border-sky-200/40',
      chipBg: 'bg-sky-100 text-sky-800',
    },
    {
      level: 'Heavy',
      score: '-10 điểm',
      when: 'Thường áp dụng khi bị reject từ 5 lần trong 7 ngày hoặc đã có penalty Heavy gần đây',
      action: 'Ban tạm thời (3-7 ngày tuỳ mức)',
      color: 'from-rose-300/35 to-pink-300/20 border-rose-200/40',
      chipBg: 'bg-rose-100 text-rose-800',
    },
  ];

  const rewardRules = [
    {
      title: 'Approve bonus',
      detail: '+0.5 điểm quality score cho mỗi task được approve',
    },
    {
      title: 'Approval streak (7 ngày)',
      detail: '>= 5 approvals: +2 điểm | >= 10 approvals: +3 điểm',
    },
    {
      title: 'Gỡ cảnh báo / giảm mức phạt',
      detail: 'Nếu đang có penalty Warning/Light và đạt >= 3 approvals (7 ngày) có thể được resolve cảnh báo cũ và +2 điểm',
    },
    {
      title: 'Gỡ hạn chế',
      detail: 'Nếu quality score ≥ 80 thì tự động gỡ hạn chế và đặt lại giới hạn tuần (weeklyTaskLimit)',
    },
  ];

  const rejectionPolicy = [
    {
      title: 'Lần 1 bị reject (7 ngày)',
      detail: 'Tạo Warning (cảnh báo) nhưng chưa trừ điểm',
    },
    {
      title: 'Lần 2 bị reject (7 ngày)',
      detail: 'Penalty Warning: trừ 2 điểm, hành động: đọc guideline',
    },
    {
      title: 'Lần 3-4 bị reject (7 ngày)',
      detail: 'Penalty Light: trừ 5 điểm, Hành động: giới hạn task/tuần (giới hạn task/tuần giảm dần, tối thiểu 5)',
    },
    {
      title: 'Lần >= 5 bị reject (7 ngày)',
      detail: 'Penalty Heavy: trừ 10 điểm, Hành động: ban tạm thời (3-7 ngày)',
    },
  ];

  const GlassCard = ({ title, children }) => (
    <div className="rounded-2xl border border-white/25 bg-white/10 backdrop-blur-md p-5 text-white shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
      <h2 className="text-lg font-extrabold tracking-tight text-white/95">{title}</h2>
      <div className="mt-3 text-sm text-white/85">{children}</div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="rounded-[28px] p-6 md:p-8 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 shadow-[0_30px_80px_rgba(0,0,0,0.28)] border border-white/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.25),transparent_50%),radial-gradient(circle_at_85%_30%,rgba(255,255,255,0.18),transparent_45%)] pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">Quy định thưởng & phạt</h1>
              <p className="mt-1 text-white/80">Dành cho role Annotator (tóm tắt cơ chế hiện tại trong hệ thống)</p>
            </div>
            <button
              onClick={() => navigate('/annotator/tasks')}
            className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold transition-colors"
            >
            MỞ MY TASKS
            </button>
        </div>

        <div className="relative mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlassCard title="Thưởng (Rewards)">
            <div className="space-y-3">
              {rewardRules.map((r) => (
                <div key={r.title} className="p-3 rounded-xl bg-white/10 border border-white/20">
                  <div className="font-semibold text-white/95">{r.title}</div>
                  <div className="text-sm text-white/75 mt-1">{r.detail}</div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard title="Phạt (Penalty levels)">
            <div className="space-y-3">
              {penaltyLevels.map((p) => (
                <div key={p.level} className={`p-3 rounded-xl border bg-gradient-to-r ${p.color}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-white">{p.level}</div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.chipBg}`}>{p.score}</span>
                  </div>
                  <div className="text-sm text-white/80 mt-2">{p.when}</div>
                  <div className="text-xs text-white/70 mt-1">Action: {p.action}</div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard title="Cơ chế khi bị reject (7 ngày)">
            <div className="space-y-3">
              {rejectionPolicy.map((p) => (
                <div key={p.title} className="p-3 rounded-xl bg-white/10 border border-white/20">
                  <div className="font-semibold text-white/95">{p.title}</div>
                  <div className="text-sm text-white/75 mt-1">{p.detail}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AnnotatorRules;
