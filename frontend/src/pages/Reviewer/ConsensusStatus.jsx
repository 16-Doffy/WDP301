import React from 'react';

const ConsensusStatus = ({ reviewers = [], task }) => {
  const totalReviewers = reviewers.length;
  const approvedCount = reviewers.filter((r) => r.status === 'approved').length;
  const rejectedCount = reviewers.filter((r) => r.status === 'rejected').length;
  const pendingCount = reviewers.filter((r) => r.status === 'pending').length;
  const decidedCount = approvedCount + rejectedCount;

  const getAvatarInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-200">Review Progress</h4>
        <span className="text-xs text-gray-400">
          {decidedCount}/{totalReviewers} voted
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-gray-700 overflow-hidden flex">
        {reviewers.map((reviewer, idx) => {
          const width = 100 / totalReviewers;
          let bgColor = 'bg-gray-600';
          if (reviewer.status === 'approved') bgColor = 'bg-emerald-500';
          if (reviewer.status === 'rejected') bgColor = 'bg-rose-500';
          return (
            <div
              key={reviewer.reviewerId?._id || reviewer.reviewerId || idx}
              className={`h-full ${bgColor} transition-all duration-300`}
              style={{ width: `${width}%` }}
              title={`${reviewer.reviewerId?.fullName || reviewer.reviewerId?.username || 'Reviewer ' + (idx + 1)}: ${reviewer.status}`}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs text-gray-400">
            Approve: <span className="font-semibold text-emerald-400">{approvedCount}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="text-xs text-gray-400">
            Reject: <span className="font-semibold text-rose-400">{rejectedCount}</span>
          </span>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
            <span className="text-xs text-gray-400">
              Pending: <span className="font-semibold text-gray-300">{pendingCount}</span>
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {reviewers.map((reviewer, idx) => {
          const name = reviewer.reviewerId?.fullName || reviewer.reviewerId?.username || `Reviewer ${idx + 1}`;
          const isMe = reviewer.reviewerId?._id === task?.currentUserId || reviewer.reviewerId === task?.currentUserId;

          return (
            <div key={reviewer.reviewerId?._id || reviewer.reviewerId || idx} className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  reviewer.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                  reviewer.status === 'rejected' ? 'bg-rose-500/20 text-rose-400' :
                  'bg-gray-700 text-gray-400'
                }`}>
                  {getAvatarInitials(name)}
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-xs font-medium ${isMe ? 'text-blue-400' : 'text-gray-200'}`}>
                    {name}
                    {isMe && <span className="ml-1 text-blue-300">(you)</span>}
                  </p>
                  {reviewer.reviewedAt && (
                    <p className="text-[10px] text-gray-500">
                      {new Date(reviewer.reviewedAt).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                {reviewer.status === 'approved' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Approved
                  </span>
                )}
                {reviewer.status === 'rejected' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                    Rejected
                  </span>
                )}
                {reviewer.status === 'pending' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                    Waiting
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {decidedCount === totalReviewers && totalReviewers > 1 && (
        <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${
          approvedCount > rejectedCount
            ? 'border-emerald-700/50 bg-emerald-500/5 text-emerald-400'
            : 'border-rose-700/50 bg-rose-500/5 text-rose-400'
        }`}>
          {approvedCount > rejectedCount
            ? `Majority approved (${approvedCount} vs ${rejectedCount})`
            : approvedCount === rejectedCount
              ? `Tie (${approvedCount} vs ${rejectedCount}) - task rejected`
              : `Majority rejected (${rejectedCount} vs ${approvedCount})`}
        </div>
      )}

      {totalReviewers === 1 && decidedCount === 1 && (
        <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${
          approvedCount === 1
            ? 'border-emerald-700/50 bg-emerald-500/5 text-emerald-400'
            : 'border-rose-700/50 bg-rose-500/5 text-rose-400'
        }`}>
          {approvedCount === 1
            ? 'Single reviewer approved - Task approved'
            : 'Single reviewer rejected - Task rejected'}
        </div>
      )}
    </div>
  );
};

export default ConsensusStatus;