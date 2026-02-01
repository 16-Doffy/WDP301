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
      color: 'border-amber-500',
      chipBg: 'bg-amber-50 text-amber-700',
    },
    {
      level: 'Light',
      score: '-5 điểm',
      when: 'Thường áp dụng khi bị reject từ 3 lần trong 7 ngày hoặc đã có penalty Light gần đây',
      action: 'Giảm số task/tuần',
      color: 'border-sky-500',
      chipBg: 'bg-sky-50 text-sky-700',
    },
    {
      level: 'Heavy',
      score: '-10 điểm',
      when: 'Thường áp dụng khi bị reject từ 5 lần trong 7 ngày hoặc đã có penalty Heavy gần đây',
      action: 'Ban tạm thời (3-7 ngày tuỳ mức)',
      color: 'border-rose-500',
      chipBg: 'bg-rose-50 text-rose-700',
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

  const Card = ({ title, children }) => (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 text-sm text-gray-700">{children}</div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="p-6">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Quy định thưởng & phạt</h1>
              <p className="mt-1 text-white/80">Dành cho role Annotator (tóm tắt cơ chế hiện tại trong hệ thống)</p>
            </div>
            <button
              onClick={() => navigate('/annotator/tasks')}
              className="px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 transition-colors font-semibold"
            >
              Mở My Tasks
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card title="Thưởng (Rewards)">
            <div className="space-y-3">
              {rewardRules.map((r) => (
                <div key={r.title} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="font-semibold text-gray-900">{r.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{r.detail}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Phạt (Penalty levels)">
            <div className="space-y-3">
              {penaltyLevels.map((p) => (
                <div key={p.level} className={`p-3 rounded-xl border ${p.color} bg-white`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-semibold text-gray-900">{p.level}</div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.chipBg}`}>{p.score}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">{p.when}</div>
                  <div className="text-xs text-gray-500 mt-1">Action: {p.action}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Cơ chế khi bị reject (7 ngày)">
            <div className="space-y-3">
              {rejectionPolicy.map((p) => (
                <div key={p.title} className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="font-semibold text-gray-900">{p.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{p.detail}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AnnotatorRules;
