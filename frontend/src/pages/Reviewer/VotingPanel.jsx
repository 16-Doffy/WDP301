import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, FormControl, InputLabel, Select, MenuItem, Typography } from '@mui/material';

const ERROR_CATEGORIES = [
  { value: 'incorrect_label', label: 'Incorrect Label - Chon sai nhan cho doi tuong' },
  { value: 'missing_label', label: 'Missing Label - Thieu doi tuong chua duoc gan nhan' },
  { value: 'poor_quality', label: 'Poor Quality - Chat luong annotation kem' },
  { value: 'does_not_follow_guidelines', label: 'Does Not Follow Guidelines - Khong tuan thu huong dan' },
  { value: 'other', label: 'Other - Ly do khac' },
];

const VotingPanel = ({ task, onApprove, onReject, loading, hasVoted, currentUserVote }) => {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [errorCategory, setErrorCategory] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const isTaskOverdue = task?.projectId?.deadline && new Date(task.projectId.deadline) < new Date();
  const isDisabled = hasVoted || isTaskOverdue || loading;

  const handleApprove = () => {
    if (loading) return;
    onApprove({ reviewComments: '' });
  };

  const handleOpenReject = () => setShowRejectDialog(true);

  const handleCloseReject = () => {
    setShowRejectDialog(false);
    setErrorCategory('');
    setRejectReason('');
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) return;
    onReject({ reviewComments: rejectReason, errorCategory: errorCategory || 'other' });
    handleCloseReject();
  };

  return (
    <div className="space-y-4">
      {currentUserVote && (
        <div className={`rounded-lg border px-4 py-2 text-sm font-medium ${
          currentUserVote === 'approved'
            ? 'border-emerald-700/50 bg-emerald-500/10 text-emerald-400'
            : currentUserVote === 'rejected'
              ? 'border-rose-700/50 bg-rose-500/10 text-rose-400'
              : 'border-gray-700 bg-gray-800 text-gray-400'
        }`}>
          Your vote: <span className="font-bold uppercase">{currentUserVote}</span>
          {task?.status !== 'submitted' && <span className="ml-2 text-xs opacity-70">(Finalized)</span>}
        </div>
      )}

      {isTaskOverdue && !hasVoted && (
        <div className="rounded-lg border border-rose-700/50 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
          This task is past the project deadline. Review is disabled.
        </div>
      )}

      {hasVoted && task?.status === 'submitted' && (
        <div className="rounded-lg border border-amber-700/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          You have voted. Waiting for other reviewers to finalize the decision.
        </div>
      )}

      {task?.status !== 'submitted' && (
        <div className={`rounded-lg border px-4 py-2 text-sm font-medium ${
          task?.status === 'approved'
            ? 'border-emerald-700/50 bg-emerald-500/10 text-emerald-400'
            : 'border-rose-700/50 bg-rose-500/10 text-rose-400'
        }`}>
          Finalized as: <span className="font-bold uppercase">{task?.status}</span>
        </div>
      )}

      {!hasVoted && !isTaskOverdue && (
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            disabled={isDisabled || loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <span className="animate-pulse">Processing...</span> : (
              <>
                <span className="text-lg">Approve</span>
                <kbd className="ml-1 rounded bg-emerald-800 px-1.5 py-0.5 text-[10px] font-mono text-emerald-200">A</kbd>
              </>
            )}
          </button>

          <button
            onClick={handleOpenReject}
            disabled={isDisabled || loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <span className="animate-pulse">Processing...</span> : (
              <>
                <span className="text-lg">Reject</span>
                <kbd className="ml-1 rounded bg-rose-800 px-1.5 py-0.5 text-[10px] font-mono text-rose-200">R</kbd>
              </>
            )}
          </button>
        </div>
      )}

      {!hasVoted && !isTaskOverdue && !loading && (
        <div className="flex items-center justify-center gap-4 text-[10px] text-gray-500">
          <span>Press <kbd className="rounded bg-gray-800 px-1 font-mono">A</kbd> to Approve</span>
          <span>Press <kbd className="rounded bg-gray-800 px-1 font-mono">R</kbd> to Reject</span>
        </div>
      )}

      <Dialog open={showRejectDialog} onClose={handleCloseReject} maxWidth="sm" fullWidth>
        <DialogTitle className="bg-gray-800 text-gray-100">Reject Task - Provide Reason</DialogTitle>
        <DialogContent className="bg-gray-900">
          <div className="space-y-4 pt-2">
            <Typography variant="body2" className="text-gray-400">
              Please provide detailed feedback for the annotator so they can improve their work.
            </Typography>

            <FormControl fullWidth size="small">
              <InputLabel className="text-gray-400">Error Category</InputLabel>
              <Select
                value={errorCategory}
                onChange={(e) => setErrorCategory(e.target.value)}
                label="Error Category"
                className="bg-gray-800 text-gray-200"
              >
                {ERROR_CATEGORIES.map((cat) => (
                  <MenuItem key={cat.value} value={cat.value} className="text-gray-200 hover:bg-gray-800">
                    {cat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Reject Reason (required)"
              multiline
              rows={4}
              fullWidth
              size="small"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain what's wrong with this annotation. Be specific so the annotator can fix it."
              className="bg-gray-800"
              InputProps={{ className: 'text-gray-200' }}
              InputLabelProps={{ className: 'text-gray-400' }}
            />
          </div>
        </DialogContent>
        <DialogActions className="bg-gray-900">
          <Button onClick={handleCloseReject} className="text-gray-400">Cancel</Button>
          <Button
            onClick={handleConfirmReject}
            variant="contained"
            color="error"
            disabled={!rejectReason.trim() || loading}
            className="bg-rose-600"
          >
            {loading ? 'Submitting...' : 'Confirm Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default VotingPanel;