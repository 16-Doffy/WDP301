const mongoose = require('mongoose');

const penaltySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['annotator', 'reviewer', 'manager'],
    required: true
  },
  level: {
    type: String,
    enum: ['warning', 'light', 'heavy'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  errorType: {
    type: String,
    enum: [
      'wrong_label',
      'missed_guideline',
      'sloppy_work',
      'deadline_missed',
      'repeat_error',
      'fraud',
      'wrong_approval',
      'wrong_rejection',
      'overload_assignment',
      'poor_dataset_quality'
    ]
  },
  relatedTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  relatedProjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  scoreDeduction: {
    type: Number,
    default: 0
  },
  action: {
    type: String,
    enum: [
      'notification',
      'read_guideline',
      'reduce_score',
      'reduce_tasks',
      'redo_free',
      'temporary_ban',
      'downgrade_level',
      'manager_approval_required',
      'reduce_review_permission',
      'audit_project',
      'restrict_export'
    ]
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'appealed'],
    default: 'active'
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
penaltySchema.index({ userId: 1, createdAt: -1 });
penaltySchema.index({ status: 1 });
penaltySchema.index({ level: 1 });

module.exports = mongoose.model('Penalty', penaltySchema);
