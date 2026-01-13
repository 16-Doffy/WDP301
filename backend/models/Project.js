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
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'draft'
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
