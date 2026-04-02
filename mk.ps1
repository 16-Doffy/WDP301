$d = "d:/Desktop/WDP/WDP301/backend/models"
$s = @"
const mongoose = require('mongoose');
const topicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  color: { type: String, default: '#3b82f6' },
  icon: { type: String, default: 'folder' },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
topicSchema.index({ managerId: 1, status: 1 });
topicSchema.index({ order: 1 });
topicSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });
module.exports = mongoose.model('Topic', topicSchema);
"@
$s2 = @"
const mongoose = require('mongoose');
const subtopicSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parentSubtopicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subtopic', default: null },
  guideline: { type: String, default: '' },
  taskType: { type: String, enum: ['classification', 'bbox', 'ner', 'sentiment', 'multi_label'], default: 'classification' },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
subtopicSchema.index({ topicId: 1, status: 1 });
subtopicSchema.index({ managerId: 1 });
subtopicSchema.index({ parentSubtopicId: 1 });
subtopicSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });
module.exports = mongoose.model('Subtopic', subtopicSchema);
"@
$s3 = @"
const mongoose = require('mongoose');
const labelSetSchema = new mongoose.Schema({
  subtopicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subtopic', required: true },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  labels: [{
    name: { type: String, required: true },
    color: { type: String, default: '#3b82f6' },
    description: { type: String, default: '' },
    shortcut: { type: String, default: '' },
  }],
  allowMultiple: { type: Boolean, default: false },
  required: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
labelSetSchema.index({ subtopicId: 1 });
labelSetSchema.index({ managerId: 1 });
labelSetSchema.pre('save', function(next) { this.updatedAt = new Date(); next(); });
module.exports = mongoose.model('LabelSet', labelSetSchema);
"@
[System.IO.File]::WriteAllText("$d/Topic.js", $s, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("$d/Subtopic.js", $s2, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText("$d/LabelSet.js", $s3, [System.Text.Encoding]::UTF8)
Write-Output "All 3 models created"
