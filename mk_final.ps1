$ErrorActionPreference = "Continue"
$routesDir = "d:/Desktop/WDP/WDP301/backend/routes"
$modelsDir = "d:/Desktop/WDP/WDP301/backend/models"

# Fix topics.js
$topicsJs = @"
const express = require('express');
const router = express.Router();
const Topic = require('../models/Topic');
const Subtopic = require('../models/Subtopic');
const Dataset = require('../models/Dataset');
const LabelSet = require('../models/LabelSet');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const filter = { status: 'active' };
    if (req.user.role !== 'admin') filter.managerId = req.user._id;
    const topics = await Topic.find(filter).sort({ order: 1, createdAt: -1 });
    const result = await Promise.all(topics.map(async (t) => {
      const subtopicIds = await Subtopic.find({ topicId: t._id, status: 'active' }).distinct('_id');
      const subtopics = subtopicIds.length;
      const datasets = await Dataset.countDocuments({ subtopicId: { `$in: subtopicIds } });
      const labels = await LabelSet.countDocuments({ subtopicId: { `$in: subtopicIds } });
      return { ...t.toObject(), subtopics, datasets, labels };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    const subtoptics = await Subtopic.find({ topicId: topic._id, status: 'active' }).sort({ order: 1 });
    res.json({ topic, subtoptics });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const topic = new Topic({ ...req.body, managerId: req.user._id });
    await topic.save();
    res.status(201).json(topic);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const topic = await Topic.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.json(topic);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const topic = await Topic.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!topic) return res.status(404).json({ error: 'Topic not found' });
    res.json({ message: 'Topic archived' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
"@

# Fix subtopics.js
$subtopicsJs = @"
const express = require('express');
const router = express.Router();
const Subtopic = require('../models/Subtopic');
const LabelSet = require('../models/LabelSet');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const filter = { status: 'active' };
    if (req.query.topicId) filter.topicId = req.query.topicId;
    if (req.user.role !== 'admin') filter.managerId = req.user._id;
    const subtoptics = await Subtopic.find(filter).sort({ order: 1 }).populate('topicId', 'name color');
    res.json(subtoptics);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const subtopic = await Subtopic.findById(req.params.id).populate('topicId', 'name color');
    if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });
    const labelSets = await LabelSet.find({ subtopicId: subtopic._id });
    res.json({ subtopic, labelSets });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const subtopic = new Subtopic({ ...req.body, managerId: req.user._id });
    await subtopic.save();
    res.status(201).json(subtopic);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const subtopic = await Subtopic.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });
    res.json(subtopic);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const subtopic = await Subtopic.findByIdAndUpdate(req.params.id, { status: 'archived' }, { new: true });
    if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });
    res.json({ message: 'Subtopic archived' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
"@

# Fix labelsets.js
$labelsetsJs = @"
const express = require('express');
const router = express.Router();
const LabelSet = require('../models/LabelSet');
const { auth, authorize } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.subtopicId) filter.subtopicId = req.query.subtopicId;
    if (req.user.role !== 'admin') filter.managerId = req.user._id;
    const labelSets = await LabelSet.find(filter).populate('subtopicId', 'name topicId');
    res.json(labelSets);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const labelSet = await LabelSet.findById(req.params.id).populate('subtopicId', 'name topicId');
    if (!labelSet) return res.status(404).json({ error: 'LabelSet not found' });
    res.json(labelSet);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const labelSet = new LabelSet({ ...req.body, managerId: req.user._id });
    await labelSet.save();
    res.status(201).json(labelSet);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const labelSet = await LabelSet.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!labelSet) return res.status(404).json({ error: 'LabelSet not found' });
    res.json(labelSet);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const labelSet = await LabelSet.findByIdAndDelete(req.params.id);
    if (!labelSet) return res.status(404).json({ error: 'LabelSet not found' });
    res.json({ message: 'LabelSet deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
"@

[System.IO.File]::WriteAllText("$routesDir/topics.js", $topicsJs, [System.Text.Encoding]::UTF8)
Write-Host "topics.js written ($(($topicsJs.Length)))"

[System.IO.File]::WriteAllText("$routesDir/subtopics.js", $subtopicsJs, [System.Text.Encoding]::UTF8)
Write-Host "subtopics.js written ($(($subtopicsJs.Length)))"

[System.IO.File]::WriteAllText("$routesDir/labelsets.js", $labelsetsJs, [System.Text.Encoding]::UTF8)
Write-Host "labelsets.js written ($(($labelsetsJs.Length)))"

Write-Host "DONE - All 3 routes files created"
