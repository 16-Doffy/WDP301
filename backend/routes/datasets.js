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

const hasUnlockedAssignedProject = async ({ datasetId, subtopicIds = [], topicId = null }) => {
  const Project = require('../models/Project');
  const Subtopic = require('../models/Subtopic');

  let datasetQuery = {};
  if (datasetId) {
    datasetQuery._id = datasetId;
  } else if (subtopicIds.length > 0) {
    datasetQuery.$or = [
      { subtopicId: { $in: subtopicIds } },
      { subtopicIds: { $in: subtopicIds } },
    ];
  } else if (topicId) {
    const relatedSubtopicIds = await Subtopic.find({ topicId, status: 'active' }).distinct('_id');
    datasetQuery.$or = [
      { subtopicId: { $in: relatedSubtopicIds } },
      { subtopicIds: { $in: relatedSubtopicIds } },
    ];
  } else {
    return false;
  }

  const datasetIds = await Dataset.find(datasetQuery).distinct('_id');
  if (datasetIds.length === 0) return false;

  const assignedTasks = await Task.find({
    datasetId: { $in: datasetIds },
    annotatorId: { $ne: null },
    $or: [
      { reviewerId: { $ne: null } },
      { 'reviewers.0': { $exists: true } },
    ],
  }).select('projectId').lean();

  const projectIds = [...new Set(assignedTasks.map(t => t.projectId?.toString()).filter(Boolean))];
  if (projectIds.length === 0) return false;

  const lockedProject = await Project.findOne({ _id: { $in: projectIds }, status: { $ne: 'completed' } }).select('_id').lean();
  return Boolean(lockedProject);
};

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

const summarizeAnnotationResult = (labels) => {
  if (!labels || typeof labels !== 'object') return 'Chưa có kết quả gán nhãn';

  if (Array.isArray(labels.objects)) {
    if (labels.objects.length === 0) return 'Image: 0 object';
    const byLabel = labels.objects.reduce((acc, obj) => {
      const key = obj?.label || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const parts = Object.entries(byLabel).map(([k, v]) => `${k}: ${v}`);
    return `Image objects (${labels.objects.length}): ${parts.join(', ')}`;
  }

  if (Array.isArray(labels.spans)) {
    if (labels.spans.length === 0) return 'Text: 0 span';
    const byLabel = labels.spans.reduce((acc, span) => {
      const key = span?.label || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const parts = Object.entries(byLabel).map(([k, v]) => `${k}: ${v}`);
    return `Text spans (${labels.spans.length}): ${parts.join(', ')}`;
  }

  if (typeof labels.label === 'string' && labels.label.trim()) {
    return `Classification: ${labels.label}`;
  }

  const keys = Object.keys(labels);
  if (keys.length === 0) return 'Chưa có kết quả gán nhãn';
  return `Annotation keys: ${keys.join(', ')}`;
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

// Get all datasets for current manager OR all datasets for admin
router.get('/', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    let datasets;
    // Admin sees all datasets, manager sees only their own
    if (req.user.role === 'admin') {
      datasets = await Dataset.find()
        .populate({
          path: 'projectId',
          select: 'name labelSet',
          options: { lean: true }
        })
        .populate('managerId', 'username fullName')
        .sort({ createdAt: -1 })
        .lean();
    } else {
      datasets = await Dataset.find({ managerId: req.user._id })
        .populate({
          path: 'projectId',
          select: 'name labelSet',
          options: { lean: true }
        })
        .sort({ createdAt: -1 })
        .lean();
    }

    // Convert to plain objects and handle null projectId
    const datasetsWithProject = datasets.map(ds => ({
      ...ds,
      projectId: ds.projectId || null,
      managerName: ds.managerId?.fullName || ds.managerId?.username || 'Unknown'
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

// Create dataset - supports both file upload AND subtopic pool reference
router.post('/', auth, authorize('manager', 'admin'), upload.array('files', 100), async (req, res) => {
  try {
    const { projectId, subtopicId, subtopicIds, name, description, type, imageCount } = req.body;
    const datasetType = (type || 'image').toString().toLowerCase();

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Dataset name is required' });
    }

    if (!['image', 'text', 'audio'].includes(datasetType)) {
      return res.status(400).json({ message: 'Invalid dataset type. Must be one of: image, text, audio' });
    }

    let managerId = req.user._id;
    if (req.user.role === 'admin' && projectId) {
      const project = await Project.findById(projectId);
      if (project) managerId = project.managerId;
    }

    let files = [];
    let totalItems = 0;
    let ic = 0;
    let labelsets = [];

    const requestedSubtopicIdsRaw = Array.isArray(subtopicIds)
      ? subtopicIds
      : (typeof subtopicIds === 'string' && subtopicIds.trim()
          ? subtopicIds.split(',').map(s => s.trim()).filter(Boolean)
          : []);
    const normalizedSubtopicIds = [...new Set((requestedSubtopicIdsRaw.length > 0 ? requestedSubtopicIdsRaw : (subtopicId ? [subtopicId] : [])).filter(Boolean).map(String))];
    const primarySubtopicId = normalizedSubtopicIds[0] || null;

    // MODE 1: Subtopic pool reference
    if (primarySubtopicId && (!req.files || req.files.length === 0)) {
      const Subtopic = require('../models/Subtopic');
      const LabelSet = require('../models/LabelSet');

      const subtopics = await Subtopic.find({ _id: { $in: normalizedSubtopicIds } }).lean();
      if (!subtopics.length) return res.status(404).json({ message: 'Subtopic not found' });

      const assetLimit = parseInt(imageCount) || 100;
      const typeKey = datasetType === 'image' ? 'image' : (datasetType === 'text' ? 'text' : 'audio');

      const pooledAssets = subtopics
        .flatMap(st => (st.assets || []).map(a => ({ ...a, _sourceSubtopicId: st._id })))
        .filter(a => a.type === typeKey);

      const uniqueAssetsMap = new Map();
      pooledAssets.forEach((a) => {
        const key = a._id?.toString?.() || a.path || a.filename || JSON.stringify(a);
        if (!uniqueAssetsMap.has(key)) uniqueAssetsMap.set(key, a);
      });
      const selectedAssets = [...uniqueAssetsMap.values()].slice(0, assetLimit);

      const subtopicLabelsets = await LabelSet.find({ subtopicId: { $in: normalizedSubtopicIds } }).lean();
      labelsets = [...new Set(subtopicLabelsets.map(ls => ls._id.toString()))];

      files = selectedAssets.map(a => ({
        filename: a.filename || (a.path || '').split('/').pop(),
        originalName: a.originalName || a.filename || 'Unknown',
        path: a.path,
        mimeType: a.mimeType || a.type,
        size: a.size || 0,
        subtopicId: a._sourceSubtopicId || primarySubtopicId,
        uploadedAt: a.uploadedAt || new Date()
      }));
      totalItems = files.length;
      ic = files.length;
    }
    // MODE 2: File upload
    else if (req.files && req.files.length > 0) {
      if (req.files.length === 1 && isArchiveUpload(req.files[0])) {
        const archiveFile = req.files[0];
        const archiveExt = path.extname(archiveFile.originalname || '').toLowerCase();

        if (archiveExt === '.rar') {
          if (archiveFile.path && fs.existsSync(archiveFile.path)) { try { fs.unlinkSync(archiveFile.path); } catch (e) {} }
          return res.status(400).json({ message: 'RAR files are not supported. Please use ZIP.' });
        }

        const extractDir = path.join('uploads/datasets', `extracted-${Date.now()}-${Math.round(Math.random() * 1e6)}`);
        try {
          files = await extractZipAndCollectFiles({ zipPath: archiveFile.path, destRoot: extractDir, datasetType });
        } finally {
          if (archiveFile.path && fs.existsSync(archiveFile.path)) { try { fs.unlinkSync(archiveFile.path); } catch (e) {} }
        }

        if (!files || files.length === 0) {
          return res.status(400).json({ message: `Archive does not contain valid files for type "${datasetType}".` });
        }
      } else {
        files = req.files.map(file => ({
          filename: file.filename,
          originalName: file.originalname,
          path: normalizePath(file.path),
          mimeType: file.mimetype,
          size: file.size,
          subtopicId: primarySubtopicId || null,
        }));
      }

      const fileErrors = validateFilesForDatasetType(datasetType, files);
      if (fileErrors.length > 0) {
        files.forEach(f => { if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path); });
        return res.status(400).json({ message: `Uploaded files do not match dataset type "${datasetType}"`, errors: fileErrors });
      }
      totalItems = files.length;
      ic = files.length;
    } else {
      return res.status(400).json({ message: 'Either upload files OR select a subtopic pool. Both cannot be empty.' });
    }

    const dataset = new Dataset({
      type: datasetType,
      projectId: projectId || null,
      subtopicId: primarySubtopicId || null,
      subtopicIds: normalizedSubtopicIds,
      managerId: managerId,
      name: name.trim(),
      description: description?.trim() || '',
      files,
      totalItems,
      imageCount: ic,
      labelsets,
      status: 'draft'
    });

    await dataset.save();

    await createActivityLog(
      req.user._id,
      'dataset_create',
      'dataset',
      dataset._id,
      `Created dataset: ${dataset.name} with ${totalItems} items from ${primarySubtopicId ? 'subtopic pool' : 'upload'}`,
      { datasetName: dataset.name, totalItems, subtopicId: primarySubtopicId, subtopicIds: normalizedSubtopicIds, source: primarySubtopicId ? 'subtopic_pool' : 'upload' },
      req
    );

    res.status(201).json(dataset);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Update dataset (Manager or Admin)
router.put('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { projectId, subtopicId, subtopicIds, name, description } = req.body;
    const dataset = await Dataset.findById(req.params.id);
    
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    // Check if user owns the dataset or is admin
    if (dataset.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // If projectId is provided, validate it
    if (projectId) {
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      // Manager can only link to their own project, Admin can link to any
      if (req.user.role !== 'admin' && project.managerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to link dataset to this project' });
      }
    }

    if (req.user.role === 'manager' && (subtopicIds !== undefined || subtopicId !== undefined)) {
      const locked = await hasUnlockedAssignedProject({ datasetId: dataset._id });
      if (locked) {
        return res.status(400).json({
          message: 'Khong the sua subtopic cua dataset da duoc phan cong trong project dang hoat dong. Chi duoc sua khi project hoan thanh hoac da xoa.',
        });
      }
    }

    if (name) dataset.name = name.trim();
    if (description !== undefined) dataset.description = description?.trim() || '';
    if (projectId !== undefined) dataset.projectId = projectId || null;

    if (subtopicIds !== undefined) {
      const incoming = Array.isArray(subtopicIds)
        ? subtopicIds
        : (typeof subtopicIds === 'string' && subtopicIds.trim()
            ? subtopicIds.split(',').map(s => s.trim()).filter(Boolean)
            : []);
      const normalized = [...new Set(incoming.filter(Boolean).map(String))];
      dataset.subtopicIds = normalized;
      dataset.subtopicId = normalized[0] || null;
    } else if (subtopicId !== undefined) {
      dataset.subtopicId = subtopicId || null;
      dataset.subtopicIds = dataset.subtopicId ? [dataset.subtopicId] : [];
    }

    await dataset.save();
    res.json(dataset);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dataset labeling status (raw vs final) - Admin sees all, Manager sees own
router.get('/:id/status', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id).populate('projectId', 'reviewPolicy');
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    // Admin can see all datasets, Manager can only see their own
    if (req.user.role !== 'admin' && dataset.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const tasks = await Task.find({ datasetId: dataset._id })
      .select('status dataItem labels reviewedAt reviewers consensusLabel consensusScore consensusMeta annotatorId')
      .populate('annotatorId', 'username fullName');

    const approvedTasks = tasks.filter((t) => t.status === 'approved');
    const rejectedTasks = tasks.filter((t) => t.status === 'rejected');
    const submittedTasks = tasks.filter((t) => t.status === 'submitted');
    const pendingAnnotationTasks = tasks.filter((t) => ['assigned', 'in_progress', 'completed'].includes(t.status));
    const returnedToAnnotatorTasks = tasks.filter((t) => t.status === 'revised');

    const consensusReadyTasks = tasks.filter((t) => t.consensusLabel != null);
    const consensusNeedsReviewTasks = tasks.filter((t) => t.consensusMeta?.needsReview === true);
    const avgConsensusScore = consensusReadyTasks.length > 0
      ? Number(
          (
            consensusReadyTasks.reduce((sum, t) => sum + (Number(t.consensusScore) || 0), 0) /
            consensusReadyTasks.length
          ).toFixed(4)
        )
      : 0;

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
    const totalTasks = tasks.length;
    const taskLifecycleRate = totalTasks > 0 ? Number(((completedTasksCount / totalTasks) * 100).toFixed(2)) : 0;
    const taskFinalRate = totalTasks > 0 ? Number(((finalItems.length / totalTasks) * 100).toFixed(2)) : 0;

    const perRawStatus = new Map();
    tasks.forEach((task) => {
      const key = task?.dataItem?.path || task?.dataItem?.filename || task?._id?.toString();
      const prev = perRawStatus.get(key) || { completed: 0, approved: 0, total: 0 };
      prev.total += 1;
      if (task.status === 'approved' || task.status === 'rejected') prev.completed += 1;
      if (task.status === 'approved') prev.approved += 1;
      perRawStatus.set(key, prev);
    });

    let rawCompletedCount = 0;
    let rawFinalCount = 0;
    perRawStatus.forEach((entry) => {
      if (entry.completed === entry.total && entry.total > 0) rawCompletedCount += 1;
      if (entry.approved > 0) rawFinalCount += 1;
    });

    const rawBase = totalRawItems > 0 ? totalRawItems : perRawStatus.size;
    const rawLifecycleRate = rawBase > 0 ? Number(((rawCompletedCount / rawBase) * 100).toFixed(2)) : 0;
    const rawFinalRate = rawBase > 0 ? Number(((rawFinalCount / rawBase) * 100).toFixed(2)) : 0;

    const annotatorStatsMap = new Map();
    tasks.forEach((task) => {
      const annotatorId = task?.annotatorId?._id?.toString?.() || task?.annotatorId?.toString?.() || 'unknown';
      const annotatorName = task?.annotatorId?.fullName || task?.annotatorId?.username || 'Unknown annotator';
      const prev = annotatorStatsMap.get(annotatorId) || {
        annotatorId,
        annotatorName,
        total: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
      };

      prev.total += 1;
      if (task.status === 'approved') prev.approved += 1;
      else if (task.status === 'rejected') prev.rejected += 1;
      else prev.pending += 1;

      annotatorStatsMap.set(annotatorId, prev);
    });

    const annotatorStats = [...annotatorStatsMap.values()]
      .map((entry) => ({
        ...entry,
        passRate: entry.total > 0 ? Number(((entry.approved / entry.total) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.approved - a.approved || a.rejected - b.rejected);

    res.json({
      datasetId: dataset._id,
      datasetName: dataset.name,
      type: dataset.type,
      totalRawItems,
      totalTasks,
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
      lifecycleRate: taskLifecycleRate,
      finalRate: taskFinalRate,
      completionRate: taskFinalRate,
      rawProgress: {
        completed: rawCompletedCount,
        final: rawFinalCount,
        lifecycleRate: rawLifecycleRate,
        finalRate: rawFinalRate,
      },
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
      consensus: {
        consensusReadyCount: consensusReadyTasks.length,
        needsReviewCount: consensusNeedsReviewTasks.length,
        avgConsensusScore,
      },
      annotators: annotatorStats,
      finalItems,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all items in dataset with their annotation status (manager/admin)
router.get('/:id/items', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id).lean();
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    // Admin can see all datasets, Manager can only see their own
    if (req.user.role !== 'admin' && dataset.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get availableLabels from tasks or from subtopic labelSets
    let availableLabels = [];
    if (dataset.subtopicId) {
      const LabelSetModel = require('../models/LabelSet');
      const labelSets = await LabelSetModel.find({ subtopicId: dataset.subtopicId }).lean();
      availableLabels = labelSets.flatMap(ls => ls.labels || []);
    }
    if (availableLabels.length === 0) {
      // Fallback: try to get from any task in this dataset
      const firstTask = await Task.findOne({ datasetId: dataset._id }).select('availableLabels').lean();
      if (firstTask?.availableLabels) availableLabels = firstTask.availableLabels;
    }

    // Get all tasks for this dataset
    const tasks = await Task.find({ datasetId: dataset._id })
      .select('status dataItem labels annotatorId reviewedAt primaryForItem reviewerId reviewers reviewComments errorCategory reviewIssues subtopicId')
      .populate('annotatorId', 'username fullName')
      .populate('reviewerId', 'username fullName')
      .populate('reviewers.reviewerId', 'username fullName')
      .populate('subtopicId', 'name')
      .lean();

    // Build items from tasks (if any exist)
    const itemsMap = new Map();

    // Get unique dataItems from tasks
    tasks.forEach((task) => {
      // Use dataItem.path or construct a unique key
      const itemPath = task.dataItem?.path || '';
      const itemKey = itemPath || task._id.toString();
      
      if (!itemsMap.has(itemKey)) {
        // Extract just the filename from the path
        const filename = itemPath ? itemPath.split('/').pop() : (task.dataItem?.filename || '');
        
        // Get labelSet from project
        let labelSet = [];
        try {
          if (task.datasetId?.projectId?.labelSet) {
            labelSet = task.datasetId.projectId.labelSet;
          }
        } catch (e) {
          // Ignore errors getting labelSet
        }
        
        itemsMap.set(itemKey, {
          id: itemKey,
          filename: task.dataItem?.filename || task.dataItem?.name || filename || 'Unknown',
          originalName: task.dataItem?.originalName || task.dataItem?.name || 'Unknown',
          type: dataset.type,
          mimeType: task.dataItem?.mimeType || dataset.type,
          path: itemPath,
          imageUrl: itemPath || (filename ? `/uploads/datasets/${filename}` : ''),
          subtopicId: task.subtopicId?._id || task.subtopicId || null,
          subtopicName: task.subtopicId?.name || null,
          labelSet,
          annotations: [],
          status: 'pending',
          approvedCount: 0,
          rejectedCount: 0,
          totalVotes: 0,
          // Include text content for text files
          text: task.dataItem?.text || null,
          // Include review info at item level
          reviewComments: task.reviewComments,
          errorCategory: task.errorCategory,
          reviewIssues: task.reviewIssues,
          reviewerId: task.reviewerId,
          reviewedAt: task.reviewedAt,
        });
      }
      const item = itemsMap.get(itemKey);
      
      // Add annotation info
      if (task.labels) {
        item.annotations.push({
          annotator: task.annotatorId?.fullName || task.annotatorId?.username || 'Unknown',
          annotatorId: task.annotatorId?._id || task.annotatorId,
          labels: task.labels,
          status: task.status,
          reviewedAt: task.reviewedAt,
          primaryForItem: Boolean(task.primaryForItem),
          // Include review information
          reviewComments: task.reviewComments,
          errorCategory: task.errorCategory,
          reviewIssues: task.reviewIssues,
          reviewerId: task.reviewerId,
        });
      }

      if (task.primaryForItem) {
        item.primaryAnnotator = task.annotatorId?.fullName || task.annotatorId?.username || 'Unknown';
      }
      
      // Update vote counts
      if (task.status === 'approved') {
        item.approvedCount += 1;
        item.status = 'approved';
      } else if (task.status === 'rejected') {
        item.rejectedCount += 1;
        if (item.status !== 'approved') item.status = 'rejected';
      } else if (task.status === 'submitted') {
        if (item.status === 'pending') item.status = 'in_review';
      }
      item.totalVotes += 1;
    });

    // Fallback: if no tasks yet, build items directly from dataset.files[]
    if (itemsMap.size === 0 && Array.isArray(dataset.files) && dataset.files.length > 0) {
      dataset.files.forEach((file, idx) => {
        const filePath = file.path || '';
        const filename = filePath ? filePath.split('/').pop() : (file.filename || 'unknown');
        itemsMap.set(filePath || `file-${idx}`, {
          id: idx + 1,
          filename: file.filename || filename,
          originalName: file.originalName || file.filename || 'Unknown',
          type: dataset.type,
          mimeType: file.mimeType || dataset.type,
          path: filePath,
          imageUrl: filePath || (filename ? `/uploads/datasets/${filename}` : ''),
          subtopicId: file.subtopicId || null,
          subtopicName: null,
          labelSet: availableLabels,
          annotations: [],
          status: 'pending',
          approvedCount: 0,
          rejectedCount: 0,
          totalVotes: 0,
          displayLabel: 'Chưa có nhãn',
        });
      });
    }

    // Fill subtopic names for fallback items
    const unresolvedSubtopicIds = Array.from(new Set(
      Array.from(itemsMap.values())
        .map((it) => it.subtopicId?.toString?.() || it.subtopicId)
        .filter(Boolean)
    ));

    if (unresolvedSubtopicIds.length > 0) {
      const SubtopicModel = require('../models/Subtopic');
      const subtopicDocs = await SubtopicModel.find({ _id: { $in: unresolvedSubtopicIds } }).select('name').lean();
      const subtopicNameMap = new Map(subtopicDocs.map((s) => [s._id.toString(), s.name]));
      itemsMap.forEach((it) => {
        if (!it.subtopicName && it.subtopicId) {
          const key = it.subtopicId?.toString?.() || String(it.subtopicId);
          it.subtopicName = subtopicNameMap.get(key) || null;
        }
      });
    }

    // Convert to array
    const items = Array.from(itemsMap.values()).map((item, index) => {
      // Try to get label from approved annotation first
      let displayLabel = 'Chưa có nhãn';
      
      if (item.annotations.length > 0) {
        // Find approved annotation for better label
        const approvedAnn = item.annotations.find(a => a.status === 'approved');
        const labels = (approvedAnn || item.annotations[0])?.labels;
        
        if (labels) {
          // For classification (single label)
          if (typeof labels.label === 'string' && labels.label.trim()) {
            displayLabel = labels.label;
          }
          // For object detection - show all labels
          else if (Array.isArray(labels.objects) && labels.objects.length > 0) {
            const labelCounts = {};
            labels.objects.forEach(obj => {
              const l = obj?.label || 'unknown';
              labelCounts[l] = (labelCounts[l] || 0) + 1;
            });
            displayLabel = Object.entries(labelCounts).map(([k, v]) => v > 1 ? `${k} (${v})` : k).join(', ');
          }
          // For text spans
          else if (Array.isArray(labels.spans) && labels.spans.length > 0) {
            const labelCounts = {};
            labels.spans.forEach(span => {
              const l = span?.label || 'unknown';
              labelCounts[l] = (labelCounts[l] || 0) + 1;
            });
            displayLabel = Object.entries(labelCounts).map(([k, v]) => v > 1 ? `${k} (${v})` : k).join(', ');
          }
          // If label is a number (e.g., bounding box count), show as string
          else if (typeof labels.label === 'number') {
            displayLabel = String(labels.label);
          }
        }
      }
      
      return {
        id: index + 1,
        ...item,
        displayLabel,
      };
    });

    // Filter by status if provided
    const { status } = req.query;
    let filteredItems = items;
    if (status && status !== 'all') {
      filteredItems = items.filter(item => item.status === status);
    }

    const groupedBySubtopic = filteredItems.reduce((acc, item) => {
      const key = item.subtopicId?.toString?.() || item.subtopicId || '__none__';
      if (!acc[key]) {
        acc[key] = {
          subtopicId: item.subtopicId || null,
          subtopicName: item.subtopicName || 'Khong ro subtopic',
          totalItems: 0,
          approved: 0,
          rejected: 0,
          inReview: 0,
          pending: 0,
        };
      }
      acc[key].totalItems += 1;
      if (item.status === 'approved') acc[key].approved += 1;
      else if (item.status === 'rejected') acc[key].rejected += 1;
      else if (item.status === 'in_review') acc[key].inReview += 1;
      else acc[key].pending += 1;
      return acc;
    }, {});

    res.json({
      datasetId: dataset._id,
      datasetName: dataset.name,
      type: dataset.type,
      totalItems: items.length,
      filteredCount: filteredItems.length,
      subtopicSummary: Object.values(groupedBySubtopic),
      items: filteredItems,
    });
  } catch (error) {
    console.error('Error fetching dataset items:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get annotator-level task breakdown for a dataset (manager/admin)
router.get('/:id/annotators/:annotatorId/tasks', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) return res.status(404).json({ message: 'Dataset not found' });

    // Admin can see all datasets, Manager can only see their own
    if (req.user.role !== 'admin' && dataset.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const tasks = await Task.find({
      datasetId: dataset._id,
      annotatorId: req.params.annotatorId,
    })
      .select('status dataItem submittedAt reviewedAt reviewComments errorCategory consensusScore consensusMeta labels')
      .sort({ updatedAt: -1 });

    const payload = {
      dataset: {
        id: dataset._id,
        name: dataset.name,
      },
      annotatorId: req.params.annotatorId,
      totals: {
        total: tasks.length,
        approved: tasks.filter((t) => t.status === 'approved').length,
        rejected: tasks.filter((t) => t.status === 'rejected').length,
        submitted: tasks.filter((t) => t.status === 'submitted').length,
        pending: tasks.filter((t) => ['assigned', 'in_progress', 'completed', 'revised'].includes(t.status)).length,
      },
      tasks: tasks.map((t) => ({
        taskId: t._id,
        annotationSummary: summarizeAnnotationResult(t.labels),
        labels: t.labels || {},
        status: t.status,
        submittedAt: t.submittedAt,
        reviewedAt: t.reviewedAt,
        reviewComments: t.reviewComments || '',
        errorCategory: t.errorCategory || '',
        consensusScore: typeof t.consensusScore === 'number' ? t.consensusScore : null,
        needsConsensusReview: Boolean(t?.consensusMeta?.needsReview),
      })),
    };

    res.json(payload);
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

    // Admin can export all datasets, Manager can only export their own
    if (req.user.role !== 'admin' && dataset.managerId.toString() !== req.user._id.toString()) {
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

// Delete dataset (Manager or Admin)
router.delete('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id);
    
    if (!dataset) {
      return res.status(404).json({ message: 'Dataset not found' });
    }

    // Check if user owns the dataset or is admin
    if (dataset.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'manager') {
      const locked = await hasUnlockedAssignedProject({ datasetId: dataset._id });
      if (locked) {
        return res.status(400).json({
          message: 'Dataset da duoc phan cong annotator/reviewer trong project dang hoat dong. Chi co the xoa khi project da hoan thanh hoac da bi xoa.',
        });
      }
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
