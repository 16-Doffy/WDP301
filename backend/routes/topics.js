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
      const datasets = await Dataset.countDocuments({ subtopicId: { $in: subtopicIds } });
      const labels = await LabelSet.countDocuments({ subtopicId: { $in: subtopicIds } });
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