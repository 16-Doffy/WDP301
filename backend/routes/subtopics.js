const express = require('express');
const router = express.Router();
const Subtopic = require('../models/Subtopic');
const LabelSet = require('../models/LabelSet');
const { auth, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/subtopics', req.params.id || 'temp');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit

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

// ===== ASSET MANAGEMENT =====
// GET /api/subtopics/:id/assets - Get all assets of a subtopic
router.get('/:id/assets', auth, async (req, res) => {
  try {
    const subtopic = await Subtopic.findById(req.params.id);
    if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });
    res.json(subtopic.assets || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/subtopics/:id/assets - Upload assets to a subtopic
router.post('/:id/assets', auth, upload.array('files', 100), async (req, res) => {
  try {
    const subtopic = await Subtopic.findById(req.params.id);
    if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });

    const newAssets = (req.files || []).map(file => {
      const ext = path.extname(file.originalname).toLowerCase();
      let assetType = 'other';
      if (/^\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(ext)) assetType = 'image';
      else if (/^\.(txt|csv|json|xml|log)$/i.test(ext)) assetType = 'text';
      else if (/^\.(mp4|avi|mov|wmv|flv|webm)$/i.test(ext)) assetType = 'video';
      else if (/^\.(mp3|wav|ogg|flac|aac)$/i.test(ext)) assetType = 'audio';
      return {
        filename: file.filename,
        originalName: file.originalname,
        path: '/uploads/subtopics/' + req.params.id + '/' + file.filename,
        mimeType: file.mimetype,
        size: file.size,
        type: assetType,
        uploadedBy: req.user._id,
        uploadedAt: new Date()
      };
    });

    subtopic.assets.push(...newAssets);
    await subtopic.save();
    res.status(201).json({ message: 'Upload thanh cong', assets: newAssets });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/subtopics/:id/assets/:assetId - Delete an asset
router.delete('/:id/assets/:assetId', auth, async (req, res) => {
  try {
    const subtopic = await Subtopic.findById(req.params.id);
    if (!subtopic) return res.status(404).json({ error: 'Subtopic not found' });

    const asset = subtopic.assets.id(req.params.assetId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    // Delete physical file
    const filePath = path.join(__dirname, '..', asset.path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    asset.deleteOne();
    await subtopic.save();
    res.json({ message: 'Xoa asset thanh cong' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;