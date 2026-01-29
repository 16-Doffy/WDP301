const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Dataset = require('../models/Dataset');
const Project = require('../models/Project');
const { auth, authorize } = require('../middleware/auth');
const { createActivityLog } = require('./activityLogs');

const router = express.Router();

const inferFileKind = (mimeType, originalName = '') => {
  const name = (originalName || '').toLowerCase();
  const mt = (mimeType || '').toLowerCase();
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('audio/')) return 'audio';
  if (mt.startsWith('text/')) return 'text';
  if (mt === 'application/json' || name.endsWith('.json')) return 'text';
  if (mt === 'application/xml' || name.endsWith('.xml')) return 'text';
  if (mt === 'text/csv' || name.endsWith('.csv')) return 'text';
  // common audio extensions when mimeType is unreliable
  if (name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.m4a') || name.endsWith('.ogg')) return 'audio';
  return 'other';
};

const validateFilesForDatasetType = (datasetType, files) => {
  const errors = [];
  for (const f of files) {
    const kind = inferFileKind(f.mimeType, f.originalName);
    if (datasetType === 'image' && kind !== 'image') {
      errors.push({ file: f.originalName || f.filename, reason: `Expected image, got ${f.mimeType || 'unknown'}` });
    }
    if (datasetType === 'audio' && kind !== 'audio') {
      errors.push({ file: f.originalName || f.filename, reason: `Expected audio, got ${f.mimeType || 'unknown'}` });
    }
    if (datasetType === 'text' && kind !== 'text') {
      errors.push({ file: f.originalName || f.filename, reason: `Expected text, got ${f.mimeType || 'unknown'}` });
    }
  }
  return errors;
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/datasets';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB (audio can be larger)
});

// Get all datasets for current manager (including unassigned ones)
router.get('/', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const datasets = await Dataset.find({ managerId: req.user._id })
      .populate({
        path: 'projectId',
        select: 'name',
        options: { lean: true }
      })
      .sort({ createdAt: -1 })
      .lean();
    
    // Convert to plain objects and handle null projectId
    const datasetsWithProject = datasets.map(ds => ({
      ...ds,
      projectId: ds.projectId || null
    }));
    
    res.json(datasetsWithProject);
  } catch (error) {
    console.error('Error fetching datasets:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all datasets for a project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const datasets = await Dataset.find({ projectId: req.params.projectId })
      .sort({ createdAt: -1 });
    res.json(datasets);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dataset by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id)
      .populate('projectId', 'name managerId');
    
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    res.json(dataset);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create dataset and upload files (Manager only)
router.post('/', auth, authorize('manager', 'admin'), upload.array('files', 100), async (req, res) => {
  try {
    const { projectId, name, description, type } = req.body;
    const datasetType = (type || 'image').toString().toLowerCase();

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Dataset name is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'At least one file is required' });
    }

    // If projectId is provided, validate it
    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      if (project.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to create dataset for this project' });
      }
    }

    const files = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      mimeType: file.mimetype,
      size: file.size
    }));

    if (!['image', 'text', 'audio'].includes(datasetType)) {
      // cleanup uploaded files
      files.forEach(f => {
        if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
      return res.status(400).json({ message: 'Invalid dataset type. Must be one of: image, text, audio' });
    }

    const fileErrors = validateFilesForDatasetType(datasetType, files);
    if (fileErrors.length > 0) {
      // cleanup uploaded files
      files.forEach(f => {
        if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
      return res.status(400).json({ 
        message: `Uploaded files do not match dataset type "${datasetType}"`,
        errors: fileErrors
      });
    }

    const dataset = new Dataset({
      type: datasetType,
      projectId: projectId || null, // Optional
      managerId: req.user._id, // Required
      name: name.trim(),
      description: description?.trim() || '',
      files,
      totalItems: files.length
    });

    await dataset.save();
    
    // Log dataset upload
    await createActivityLog(
      req.user._id,
      'dataset_upload',
      'dataset',
      dataset._id,
      `Uploaded dataset: ${dataset.name} with ${files.length} file(s)`,
      { 
        datasetName: dataset.name,
        filesCount: files.length,
        projectId: projectId || null
      },
      req
    );

    res.status(201).json(dataset);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update dataset (Manager only)
router.put('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { projectId, name, description } = req.body;
    const dataset = await Dataset.findById(req.params.id);
    
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    // Check if user owns the dataset
    if (dataset.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // If projectId is provided, validate it
    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      if (project.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to link dataset to this project' });
      }
    }

    if (name) dataset.name = name.trim();
    if (description !== undefined) dataset.description = description?.trim() || '';
    if (projectId !== undefined) dataset.projectId = projectId || null;

    await dataset.save();
    res.json(dataset);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete dataset (Manager only)
router.delete('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    // Check if user owns the dataset
    if (dataset.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete files
    dataset.files.forEach(file => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });

    const datasetName = dataset.name;
    await dataset.deleteOne();
    
    // Log dataset deletion
    await createActivityLog(
      req.user._id,
      'dataset_delete',
      'dataset',
      req.params.id,
      `Deleted dataset: ${datasetName}`,
      { datasetName },
      req
    );

    res.json({ message: 'Dataset deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
