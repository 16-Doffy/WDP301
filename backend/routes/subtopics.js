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