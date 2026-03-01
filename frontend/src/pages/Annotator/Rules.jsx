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
      chipBg: 'bg-amber-500/10 text-amber-400',
    },
    {
      level: 'Light',
      score: '-5 điểm',
      when: 'Thường áp dụng khi bị reject từ 3 lần trong 7 ngày hoặc đã có penalty Light gần đây',
      action: 'Giảm số task/tuần',
      chipBg: 'bg-sky-500/10 text-sky-400',
    },
    {
      level: 'Heavy',
      score: '-10 điểm',
      when: 'Thường áp dụng khi bị reject từ 5 lần trong 7 ngày hoặc đã có penalty Heavy gần đây',
      action: 'Ban tạm thời (3-7 ngày tuỳ mức)',
      chipBg: 'bg-rose-500/10 text-rose-400',
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

  const SectionCard = ({ title, children, hint }) => (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        {hint ? <span className="text-xs text-gray-400">{hint}</span> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-gray-200">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Quy định thưởng & phạt</h1>
              <p className="mt-1 text-sm text-gray-400">Dành cho role Annotator (tóm tắt cơ chế hiện tại trong hệ thống)</p>
            </div>
            <button
              onClick={() => navigate('/annotator/tasks')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
            >
              Mở My Tasks
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SectionCard title="Thưởng (Rewards)" hint="Cập nhật theo chính sách hệ thống">
            {rewardRules.map((r) => (
              <div key={r.title} className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                <div className="font-semibold text-gray-100">{r.title}</div>
                <div className="mt-1 text-sm text-gray-400">{r.detail}</div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Phạt (Penalty levels)" hint="Theo mức độ vi phạm">
            {penaltyLevels.map((p) => (
              <div key={p.level} className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-gray-100">{p.level}</div>
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${p.chipBg}`}>{p.score}</span>
                </div>
                <div className="mt-2 text-sm text-gray-400">{p.when}</div>
                <div className="mt-1 text-xs text-gray-500">Action: {p.action}</div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Cơ chế khi bị reject (7 ngày)" hint="Timeline xử lý">
            {rejectionPolicy.map((p) => (
              <div key={p.title} className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                <div className="font-semibold text-gray-100">{p.title}</div>
                <div className="mt-1 text-sm text-gray-400">{p.detail}</div>
              </div>
            ))}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};

export default AnnotatorRules;
