const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  labelSet: [{
    name: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: '#000000'
    },
    description: {
      type: String
    }
  }],
  questions: [{
    question: {
      type: String,
      required: true
    },
    options: [{
      key: String, // 'A', 'B', etc.
      value: String, // Text of the option
    }],
    required: {
      type: Boolean,
      default: true
    }
  }],
  guidelines: {
    type: String,
    required: true
  },
  reviewPolicy: {
    mode: {
      type: String,
      enum: ['full', 'sample'],
      default: 'full'
    },
    sampleRate: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.1
    },
    reviewersPerItem: {
      type: Number,
      min: 1,
      max: 10,
      default: 3
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'draft'
  },
  deadline: {
    type: Date
  },
  exportFormat: {
    type: String,
    enum: ['YOLO', 'VOC', 'COCO', 'JSON', 'CSV'],
    default: 'JSON'
  },
  projectReview: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: Date,
    comment: {
      type: String,
      default: ''
    }
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

module.exports = mongoose.model('Project', projectSchema);
