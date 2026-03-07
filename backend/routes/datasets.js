const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const unzipper = require('unzipper');
const mime = require('mime-types');
const Dataset = require('../models/Dataset');
const Project = require('../models/Project');
const Task = require('../models/Task');
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
  // MP4 files can contain audio (video/mp4 mimeType but may be audio-only)
  if (name.endsWith('.mp4') || name.endsWith('.m4v') || mt === 'video/mp4') return 'audio';
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

const isArchiveUpload = (file) => {
  if (!file) return false;
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mt = (file.mimetype || '').toLowerCase();
  return (
    ext === '.zip' ||
    ext === '.rar' ||
    mt === 'application/zip' ||
    mt === 'application/x-zip-compressed' ||
    mt === 'application/vnd.rar' ||
    mt === 'application/x-rar-compressed'
  );
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

// Helper function to normalize path to relative path from backend root
const normalizePath = (filePath) => {
  if (!filePath) return '';
  // Convert backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, '/');
  
  // Extract relative path from 'uploads' onwards
  const uploadsIndex = normalized.indexOf('uploads/');
  if (uploadsIndex !== -1) {
    return normalized.substring(uploadsIndex);
  }
  
  // If already relative and starts with 'uploads/', return as is
  if (normalized.startsWith('uploads/')) {
    return normalized;
  }
  
  // Fallback: if path contains 'uploads' anywhere, try to extract
  const lastUploadsIndex = normalized.lastIndexOf('uploads/');
  if (lastUploadsIndex !== -1) {
    return normalized.substring(lastUploadsIndex);
  }
  
  // If no 'uploads' found, assume it's already relative or return empty
  return normalized;
};

const extractZipAndCollectFiles = async ({ zipPath, destRoot, datasetType, maxFiles = 2000 }) => {
  ensureDir(destRoot);

  const directory = await unzipper.Open.file(zipPath);
  const extracted = [];

  // Basic protection against zip bombs (count-based)
  const candidates = directory.files.filter(f => f.type === 'File');
  if (candidates.length > maxFiles) {
    throw new Error(`ZIP contains too many files (${candidates.length}). Max allowed is ${maxFiles}.`);
  }

  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;

    // Skip macOS metadata + hidden files
    const entryPath = (entry.path || '').toString();
    if (!entryPath || entryPath.includes('__MACOSX') || entryPath.split('/').some(p => p.startsWith('.'))) {
      // drain stream
      const s = await entry.stream();
      s.autodrain();
      continue;
    }

    const baseName = path.basename(entryPath);
    const guessedMime = mime.lookup(baseName) || 'application/octet-stream';
    const kind = inferFileKind(guessedMime, baseName);
    if (datasetType === 'image' && kind !== 'image') {
      const s = await entry.stream();
      s.autodrain();
      continue;
    }
    if (datasetType === 'text' && kind !== 'text') {
      const s = await entry.stream();
      s.autodrain();
      continue;
    }
    if (datasetType === 'audio' && kind !== 'audio') {
      const s = await entry.stream();
      s.autodrain();
      continue;
    }

    // Write extracted file
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(baseName);
    const safeOutName = `${uniqueSuffix}${ext}`;
    const outPath = path.join(destRoot, safeOutName);

    await new Promise(async (resolve, reject) => {
      try {
        const readStream = await entry.stream();
        const writeStream = fs.createWriteStream(outPath);
        readStream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        readStream.on('error', reject);
      } catch (e) {
        reject(e);
      }
    });

    const stat = fs.statSync(outPath);
    extracted.push({
      filename: safeOutName,
      originalName: baseName,
      path: normalizePath(outPath),
      mimeType: guessedMime,
      size: stat.size,
    });
  }

  return extracted;
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

    let files = [];

    // Archive upload (single file). ZIP is auto-extracted; RAR is accepted but requires unpack before upload.
    if (req.files?.length === 1 && isArchiveUpload(req.files[0])) {
      const archiveFile = req.files[0];
      const archiveExt = path.extname(archiveFile.originalname || '').toLowerCase();

      if (archiveExt === '.rar') {
        // Cleanup uploaded rar before returning validation error.
        if (archiveFile.path && fs.existsSync(archiveFile.path)) {
          try { fs.unlinkSync(archiveFile.path); } catch (e) { /* ignore */ }
        }
        return res.status(400).json({
          message: 'RAR đã được nhận diện nhưng hiện hệ thống chỉ tự giải nén ZIP. Vui lòng giải nén RAR rồi upload file bên trong, hoặc nén lại thành ZIP.',
        });
      }

      const extractDir = path.join('uploads/datasets', `extracted-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
      try {
        files = await extractZipAndCollectFiles({
          zipPath: archiveFile.path,
          destRoot: extractDir,
          datasetType,
        });
      } finally {
        if (archiveFile.path && fs.existsSync(archiveFile.path)) {
          try { fs.unlinkSync(archiveFile.path); } catch (e) { /* ignore */ }
        }
      }

      if (!files || files.length === 0) {
        return res.status(400).json({
          message: `Archive không có file hợp lệ cho dataset type "${datasetType}". Vui lòng kiểm tra nội dung file nén.`,
        });
      }
    } else {
      files = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: normalizePath(file.path),
        mimeType: file.mimetype,
        size: file.size
      }));
    }

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

// Get dataset labeling status (raw vs final)
router.get('/:id/status', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id).populate('projectId', 'reviewPolicy');
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    if (dataset.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const tasks = await Task.find({ datasetId: dataset._id }).select('status dataItem labels reviewedAt reviewers');

    const approvedTasks = tasks.filter((t) => t.status === 'approved');
    const rejectedTasks = tasks.filter((t) => t.status === 'rejected');
    const submittedTasks = tasks.filter((t) => t.status === 'submitted');
    const pendingAnnotationTasks = tasks.filter((t) => ['assigned', 'in_progress', 'completed'].includes(t.status));
    const returnedToAnnotatorTasks = tasks.filter((t) => t.status === 'revised');

    const completedTasksCount = approvedTasks.length + rejectedTasks.length;

    const voteSummary = tasks.reduce(
      (acc, task) => {
        const reviewers = Array.isArray(task.reviewers) ? task.reviewers : [];
        const reviewerCount = reviewers.length;

        if (reviewerCount > 0) {
          acc.totalReviewerSlots += reviewerCount;
          acc.reviewerCounts.push(reviewerCount);
        }

        reviewers.forEach((r) => {
          if (r.status === 'approved') acc.approveVotes += 1;
          else if (r.status === 'rejected') acc.rejectVotes += 1;
          else acc.pendingVotes += 1;
        });
        return acc;
      },
      { approveVotes: 0, rejectVotes: 0, pendingVotes: 0, totalReviewerSlots: 0, reviewerCounts: [] }
    );

    const decidedVotes = voteSummary.approveVotes + voteSummary.rejectVotes;
    const totalVotes = voteSummary.approveVotes + voteSummary.rejectVotes + voteSummary.pendingVotes;

    const reviewerCounts = voteSummary.reviewerCounts;
    const configuredReviewersPerItem = Number(dataset?.projectId?.reviewPolicy?.reviewersPerItem);
    const fallbackFromTasks = reviewerCounts.length ? Math.max(...reviewerCounts) : 0;
    const reviewersPerItem = Number.isFinite(configuredReviewersPerItem) && configuredReviewersPerItem > 0
      ? configuredReviewersPerItem
      : (fallbackFromTasks > 0 ? fallbackFromTasks : 3);
    const majorityRequired = Math.floor(reviewersPerItem / 2) + 1;
    const majorityRuleLabel = `${majorityRequired}/${reviewersPerItem}`;

    const finalItems = approvedTasks.map((t) => ({
      taskId: t._id,
      dataItem: t.dataItem,
      labels: t.labels,
      reviewedAt: t.reviewedAt,
    }));

    const totalRawItems = dataset.totalItems || dataset.files?.length || 0;
    const baseCount = totalRawItems > 0 ? totalRawItems : tasks.length;
    const lifecycleRate = baseCount > 0 ? Number(((completedTasksCount / baseCount) * 100).toFixed(2)) : 0;
    const finalRate = baseCount > 0 ? Number(((finalItems.length / baseCount) * 100).toFixed(2)) : 0;

    res.json({
      datasetId: dataset._id,
      datasetName: dataset.name,
      type: dataset.type,
      totalRawItems,
      totalTasks: tasks.length,
      totalFinalItems: finalItems.length,
      totalPendingItems: pendingAnnotationTasks.length + submittedTasks.length + returnedToAnnotatorTasks.length,
      counts: {
        pendingAnnotation: pendingAnnotationTasks.length,
        submitted: submittedTasks.length,
        inReview: submittedTasks.length,
        returnedToAnnotator: returnedToAnnotatorTasks.length,
        completed: completedTasksCount,
        approved: approvedTasks.length,
        rejected: rejectedTasks.length,
        final: finalItems.length,
      },
      lifecycleRate,
      finalRate,
      completionRate: finalRate,
      majorityThreshold: {
        required: majorityRequired,
        total: reviewersPerItem,
      },
      majorityRuleLabel,
      votes: {
        approveVotes: voteSummary.approveVotes,
        rejectVotes: voteSummary.rejectVotes,
        pendingVotes: voteSummary.pendingVotes,
        decidedVotes,
        totalVotes,
        progressLabel: `${decidedVotes}/${totalVotes}`,
      },
      finalItems,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export final dataset (only majority-approved items)
router.get('/:id/final-export', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    if (dataset.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const approvedTasks = await Task.find({ datasetId: dataset._id, status: 'approved' })
      .populate('annotatorId', 'username fullName')
      .select('dataItem labels reviewedAt annotatorId');

    if (approvedTasks.length === 0) {
      return res.status(400).json({
        message: 'Dataset chưa có item nào được đa số reviewer đồng ý (approved).',
      });
    }

    const payload = {
      dataset: {
        id: dataset._id,
        name: dataset.name,
        type: dataset.type,
        totalRawItems: dataset.totalItems || dataset.files?.length || 0,
        totalFinalItems: approvedTasks.length,
      },
      items: approvedTasks.map((t) => ({
        dataItem: t.dataItem,
        labels: t.labels,
        reviewedAt: t.reviewedAt,
        annotator: t.annotatorId?.username || t.annotatorId?.fullName || 'unknown',
      })),
      exportedAt: new Date(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="final_dataset_${dataset._id}_${Date.now()}.json"`);
    res.send(JSON.stringify(payload, null, 2));
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
