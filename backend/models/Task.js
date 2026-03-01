const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  datasetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dataset',
    required: true
  },
  annotatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dataItem: {
    filename: String,
    path: String,
    mimeType: String
  },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'submitted', 'approved', 'rejected', 'revised'],
    default: 'assigned'
  },
  labels: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  sentenceFeedbacks: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  submittedAt: {
    type: Date
  },
  reviewedAt: {
    type: Date
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewers: [
    {
      reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
      },
      comment: String,
      reviewedAt: Date
    }
  ],
  reviewNotes: [
    {
      bbox: [Number],
      label: String,
      comment: String,
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  reviewComments: {
    type: String
  },
  errorCategory: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Task', taskSchema);
