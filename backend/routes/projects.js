const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Dataset = require('../models/Dataset');
const Subtopic = require('../models/Subtopic');
const LabelSet = require('../models/LabelSet');
const { auth, authorize } = require('../middleware/auth');
const { createActivityLog } = require('./activityLogs');

const router = express.Router();



// REVIEWER PROJECT FINALIZE FUNCTIONS
const calculateApprovalRate = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found');
  const tasks = await Task.find({ projectId }).select('status');
  const totalTasks = tasks.length;
  const approvedTasks = tasks.filter(t => t.status === 'approved').length;
  const rejectedTasks = tasks.filter(t => t.status === 'rejected').length;
  const expiredTasks = tasks.filter(t => t.status === 'expired').length;
  const submittedTasks = tasks.filter(t => t.status === 'submitted').length;
  // waiting_rework = annotator dang sua lai sau reject
  // revised = annotator da sua xong, dang cho submit
  // rejected = reviewer da reject roi, chua duoc sua lai
  const waitingReworkTasks = tasks.filter(t => ['waiting_rework','revised'].includes(t.status)).length;
  const pendingTasks = tasks.filter(t => ['assigned','in_progress'].includes(t.status)).length;
  const reviewedTasks = approvedTasks + rejectedTasks + expiredTasks;
  const approvalRate = totalTasks > 0 ? Math.round((approvedTasks / totalTasks) * 10000) / 100 : 0;
  return { totalTasks, approvedTasks, rejectedTasks, expiredTasks, submittedTasks, waitingReworkTasks, pendingTasks, reviewedTasks, approvalRate, deadline: project.deadline };
};

const canFinalizeProject = async (projectId) => {
  const stats = await calculateApprovalRate(projectId);
  const project = await Project.findById(projectId);
  const deadlinePassed = project.deadline && new Date() >= new Date(project.deadline);
  const allReviewed = stats.submittedTasks === 0 && stats.pendingTasks === 0 && stats.waitingReworkTasks === 0;
  if (!allReviewed && !deadlinePassed) return { canFinalize: false, reason: 'still_has_unreviewed', message: 'Con '+stats.submittedTasks+' task chua duoc review, '+stats.waitingReworkTasks+' task dang cho rework, '+stats.pendingTasks+' task chua assign', stats };
  if (!deadlinePassed && stats.submittedTasks > 0) return { canFinalize: false, reason: 'still_has_submitted', message: stats.submittedTasks+' task dang cho reviewer cham.', stats };
  if (!deadlinePassed && stats.waitingReworkTasks > 0) return { canFinalize: false, reason: 'has_rework_pending', message: stats.waitingReworkTasks+' task dang cho annotator sua lai.', stats };
  return { canFinalize: true, reason: 'ready', message: 'Project da san sang de finalize', stats, suggestedAction: stats.approvalRate >= 70 ? 'APPROVE' : 'REJECT' };
};

const computeProjectReviewSnapshot = async (projectId) => {
  const tasks = await Task.find({ projectId }).select('status');

  const total = tasks.length;
  const approved = tasks.filter((t) => t.status === 'approved').length;
  const rejected = tasks.filter((t) => t.status === 'rejected').length;
  const submitted = tasks.filter((t) => t.status === 'submitted').length;
  const pending = tasks.filter((t) => ['assigned', 'in_progress', 'completed', 'revised'].includes(t.status)).length;
  const actionableLeft = submitted + pending;

  let suggestedStatus = 'pending';
  if (total > 0 && actionableLeft === 0) {
    suggestedStatus = rejected > 0 ? 'rejected' : (approved > 0 ? 'approved' : 'pending');
  }

  return {
    totals: { total, approved, rejected, submitted, pending },
    actionableLeft,
    suggestedStatus,
  };
};

// Get all projects (Admin sees all, Manager sees own)
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    // Admin sees all projects, Manager sees only their own
    if (req.user.role === 'manager') {
      query.managerId = req.user._id;
    }
    // admin role can see all projects (no filter)
    
    const projects = await Project.find(query)
      .populate('managerId', 'username fullName email')
      .populate('projectReview.reviewedBy', 'username fullName')
      .sort({ createdAt: -1 });

    const withSnapshot = await Promise.all(
      projects.map(async (p) => {
        const snapshot = await computeProjectReviewSnapshot(p._id);
        return {
          ...p.toObject(),
          projectReviewSnapshot: snapshot,
        };
      })
    );

    res.json(withSnapshot);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get project by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('managerId', 'username fullName email')
      .populate('projectReview.reviewedBy', 'username fullName');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Authorization check - Manager can only see their own projects, Admin can see all
    if (req.user.role === 'manager' && project.managerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this project' });
    }
    // Admin can view any project (no additional check needed)

    // Get statistics
    const stats = await Task.aggregate([
      { $match: { projectId: project._id } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);

    const projectReviewSnapshot = await computeProjectReviewSnapshot(project._id);

    res.json({ project, stats, projectReviewSnapshot });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create project (Manager or Admin)
router.post('/', auth, authorize('manager', 'admin'), [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('guidelines').trim().notEmpty().withMessage('Guidelines are required'),
  body('questions').optional().isArray().withMessage('questions must be an array'),
  body('reviewPolicy').optional().isObject().withMessage('reviewPolicy must be object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Validate questions if provided
    if (req.body.questions && Array.isArray(req.body.questions)) {
      for (const question of req.body.questions) {
        if (!question.question || question.question.trim() === '') {
          return res.status(400).json({ message: 'All questions must have question text' });
        }
        if (!question.options || !Array.isArray(question.options) || question.options.length < 2) {
          return res.status(400).json({ message: 'Each question must have at least 2 options' });
        }
      }
    }

    // Validate deadline: if provided, it must be in the future
    let deadline;
    if (req.body.deadline) {
      deadline = new Date(req.body.deadline);
      if (Number.isNaN(deadline.getTime())) {
        return res.status(400).json({ message: 'Invalid deadline date' });
      }
      const now = new Date();
      if (deadline <= now) {
        return res.status(400).json({
          message: 'Deadline must be in the future. Please choose a date/time later than now.',
        });
      }
    }

    // For admin: allow creating project for any manager (or self)
    // For manager: can only create project for themselves
    let managerId = req.user._id;
    if (req.user.role === 'admin' && req.body.managerId) {
      // Admin can specify a managerId to assign the project to
      managerId = req.body.managerId;
    }

    const project = new Project({
      name: req.body.name.trim(),
      description: req.body.description?.trim() || '',
      guidelines: req.body.guidelines.trim(),
      questions: req.body.questions || [],
      managerId: managerId,
      status: req.body.status || 'draft',
      reviewPolicy: {
        mode: req.body.reviewPolicy?.mode || 'full',
        sampleRate: typeof req.body.reviewPolicy?.sampleRate === 'number'
          ? Math.min(1, Math.max(0, req.body.reviewPolicy.sampleRate))
          : 0.1
      },
      deadline,
      exportFormat: req.body.exportFormat || 'JSON'
    });

    await project.save();
    await project.populate('managerId', 'username fullName email');

    // Log project creation
    await createActivityLog(
      req.user._id,
      'project_create',
      'project',
      project._id,
      `Created project: ${project.name}`,
      { projectName: project.name, status: project.status },
      req
    );

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update project (Manager only)
router.put('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Validate deadline if provided in update
    if (req.body.deadline) {
      const deadline = new Date(req.body.deadline);
      if (Number.isNaN(deadline.getTime())) {
        return res.status(400).json({ message: 'Invalid deadline date' });
      }
      const now = new Date();
      if (deadline <= now) {
        return res.status(400).json({
          message: 'Deadline must be in the future. Please choose a date/time later than now.',
        });
      }
    }

    const oldName = project.name;

    // Only allow updating safe editable fields.
    // Never allow managerId or other protected fields to be overwritten from client payload.
    const allowedUpdates = [
      'name',
      'description',
      'guidelines',
      'questions',
      'status',
      'deadline',
      'exportFormat'
    ];

    for (const field of allowedUpdates) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        project[field] = req.body[field];
      }
    }

    if (req.body.reviewPolicy) {
      project.reviewPolicy = {
        mode: req.body.reviewPolicy.mode || project.reviewPolicy?.mode || 'full',
        sampleRate: typeof req.body.reviewPolicy.sampleRate === 'number'
          ? Math.min(1, Math.max(0, req.body.reviewPolicy.sampleRate))
          : (project.reviewPolicy?.sampleRate ?? 0.1)
      };
    }

    project.updatedAt = new Date();
    await project.save();
    await project.populate('managerId', 'username fullName email');

    // Log project update
    await createActivityLog(
      req.user._id,
      'project_update',
      'project',
      project._id,
      `Updated project: ${project.name}`,
      { oldName, newName: project.name },
      req
    );

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete project (Manager only)
router.delete('/:id', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Task.deleteMany({ projectId: project._id });
    const projectName = project.name;
    await project.deleteOne();

    // Log project deletion
    await createActivityLog(
      req.user._id,
      'project_delete',
      'project',
      req.params.id,
      `Deleted project: ${projectName}`,
      { projectName },
      req
    );

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Get quality statistics for project (Manager or Admin)
router.get('/:id/quality', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Admin can see all projects, Manager can only see their own
    if (req.user.role !== 'admin' && project.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const tasks = await Task.find({ projectId: project._id })
      .populate('annotatorId', 'username fullName')
      .populate('reviewerId', 'username fullName');

    const stats = {
      total: tasks.length,
      approved: tasks.filter(t => t.status === 'approved').length,
      rejected: tasks.filter(t => t.status === 'rejected').length,
      submitted: tasks.filter(t => t.status === 'submitted').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      assigned: tasks.filter(t => t.status === 'assigned').length,
      approvalRate: tasks.length > 0 
        ? (tasks.filter(t => t.status === 'approved').length / tasks.length * 100).toFixed(2)
        : 0,
      rejectionRate: tasks.length > 0
        ? (tasks.filter(t => t.status === 'rejected').length / tasks.length * 100).toFixed(2)
        : 0,
      errorCategories: {},
      annotatorStats: {},
      reviewerStats: {}
    };

    // Error category statistics
    tasks.filter(t => t.errorCategory).forEach(task => {
      stats.errorCategories[task.errorCategory] = (stats.errorCategories[task.errorCategory] || 0) + 1;
    });

    // Annotator statistics
    tasks.forEach(task => {
      const annotatorName = task.annotatorId?.fullName || task.annotatorId?.username || 'Unknown';
      if (!stats.annotatorStats[annotatorName]) {
        stats.annotatorStats[annotatorName] = {
          total: 0,
          approved: 0,
          rejected: 0,
          reviewed: 0,
          approvalRate: 0,
          rejectionRate: 0
        };
      }
      stats.annotatorStats[annotatorName].total++;
      if (task.status === 'approved') stats.annotatorStats[annotatorName].approved++;
      if (task.status === 'rejected') stats.annotatorStats[annotatorName].rejected++;
    });

    // Calculate approval rates for each annotator
    Object.keys(stats.annotatorStats).forEach(annotator => {
      const annotatorStat = stats.annotatorStats[annotator];
      const reviewed = annotatorStat.approved + annotatorStat.rejected;
      annotatorStat.reviewed = reviewed;
      annotatorStat.approvalRate = reviewed > 0
        ? (annotatorStat.approved / reviewed * 100).toFixed(2)
        : 0;
      annotatorStat.rejectionRate = reviewed > 0
        ? (annotatorStat.rejected / reviewed * 100).toFixed(2)
        : 0;
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Reviewer project-level decision (approve/reject after task review)
// REVIEW SUMMARY
router.get('/:id/review-summary', auth, authorize('reviewer','admin','manager'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    if (req.user.role === 'manager' && project.managerId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not authorized' });
    const stats = await calculateApprovalRate(project._id);
    const canFinalize = await canFinalizeProject(project._id);
    res.json({ project: { _id: project._id, name: project.name, status: project.status, deadline: project.deadline, projectReview: project.projectReview }, stats, canFinalize });
  } catch (error) { res.status(500).json({ message: 'Server error', error: error.message }); }
});

// APPROVE PROJECT
router.post('/:id/approve', auth, authorize('reviewer','admin'), async (req, res) => {
  try {
    const { comment } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const check = await canFinalizeProject(project._id);
    if (!check.canFinalize) return res.status(400).json({ message: check.message, reason: check.reason, stats: check.stats });
    if (check.stats.approvalRate < 70) return res.status(400).json({ message: 'Approval rate '+check.stats.approvalRate+'% < 70%. Khong du dieu kien approve.', stats: check.stats, suggestedAction: 'REJECT' });
    project.projectReview = { status: 'approved', reviewedBy: req.user._id, reviewedAt: new Date(), comment: (comment||'').trim(), approvalRate: check.stats.approvalRate, approvedTasks: check.stats.approvedTasks, rejectedTasks: check.stats.rejectedTasks, expiredTasks: check.stats.expiredTasks||0, pendingTasks: check.stats.pendingTasks||0 };
    project.totalTasks = check.stats.totalTasks;
    project.reviewedTasks = check.stats.reviewedTasks;
    project.status = 'completed';
    await project.save();
    await project.populate('projectReview.reviewedBy', 'username fullName');
    await createActivityLog(req.user._id, 'project_approved', 'project', project._id, 'Approved project: '+project.name, { approvalRate: check.stats.approvalRate, approvedTasks: check.stats.approvedTasks, totalTasks: check.stats.totalTasks }, req);
    res.json({ message: 'Project approved voi approval rate '+check.stats.approvalRate+'%', project, stats: check.stats });
  } catch (error) { res.status(500).json({ message: 'Server error', error: error.message }); }
});

// REJECT PROJECT
router.post('/:id/reject', auth, authorize('reviewer','admin'), async (req, res) => {
  try {
    const { comment } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });
    const check = await canFinalizeProject(project._id);
    if (!check.canFinalize) return res.status(400).json({ message: check.message, reason: check.reason, stats: check.stats });
    if (check.stats.approvalRate >= 70) return res.status(400).json({ message: 'Approval rate '+check.stats.approvalRate+'% >= 70%. Ban nen approve project.', stats: check.stats, suggestedAction: 'APPROVE' });
    await Task.updateMany({ projectId: project._id, status: 'submitted' }, { $set: { status: 'expired' } });
    project.projectReview = { status: 'rejected', reviewedBy: req.user._id, reviewedAt: new Date(), comment: (comment||'').trim(), approvalRate: check.stats.approvalRate, approvedTasks: check.stats.approvedTasks, rejectedTasks: check.stats.rejectedTasks, expiredTasks: (check.stats.expiredTasks||0)+check.stats.submittedTasks, pendingTasks: check.stats.pendingTasks||0 };
    project.totalTasks = check.stats.totalTasks;
    project.reviewedTasks = check.stats.reviewedTasks;
    project.status = 'completed';
    await project.save();
    await project.populate('projectReview.reviewedBy', 'username fullName');
    await createActivityLog(req.user._id, 'project_rejected', 'project', project._id, 'Rejected project: '+project.name, { approvalRate: check.stats.approvalRate, approvedTasks: check.stats.approvedTasks, totalTasks: check.stats.totalTasks }, req);
    res.json({ message: 'Project rejected voi approval rate '+check.stats.approvalRate+'%', project, stats: check.stats });
  } catch (error) { res.status(500).json({ message: 'Server error', error: error.message }); }
});

// Export all approved tasks from a project
router.get('/:id/export', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    if (req.user.role !== 'admin' && project.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { format = 'json' } = req.query;

    // Lấy TẤT CẢ approved tasks trong project
    const approvedTasks = await Task.find({ projectId: project._id, status: 'approved' })
      .populate('annotatorId', 'username fullName')
      .populate('subtopicId', 'name taskType')
      .populate('datasetId', 'name type')
      .select('dataItem labels reviewedAt annotatorId subtopicId datasetId');

    if (approvedTasks.length === 0) {
      return res.status(400).json({ message: 'Project chưa có task nào được approved.' });
    }

    const projectInfo = {
      id: project._id,
      name: project.name,
      exportFormat: project.exportFormat || 'JSON',
      totalExported: approvedTasks.length,
    };

    let payload;

    if (format === 'json' || format === 'csv') {
      // JSON / CSV: trả về danh sách items đã gán nhãn
      payload = {
        project: projectInfo,
        items: approvedTasks.map((t) => ({
          dataItem: t.dataItem,
          labels: t.labels,
          reviewedAt: t.reviewedAt,
          annotator: t.annotatorId?.fullName || t.annotatorId?.username || 'unknown',
          subtopic: t.subtopicId?.name || 'unknown',
          dataset: t.datasetId?.name || 'unknown',
        })),
        exportedAt: new Date(),
      };

      if (format === 'csv') {
        // Convert JSON items to CSV
        const csvRows = [];
        csvRows.push('filename,annotator,subtopic,dataset,reviewedAt');
        payload.items.forEach((item) => {
          const filename = item.dataItem?.filename || '';
          const annotator = item.annotator || '';
          const subtopic = item.subtopic || '';
          const dataset = item.dataset || '';
          const reviewedAt = item.reviewedAt ? new Date(item.reviewedAt).toISOString() : '';
          csvRows.push(`"${filename}","${annotator}","${subtopic}","${dataset}","${reviewedAt}"`);
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="project_${project._id}_export.csv"`);
        return res.send(csvRows.join('\n'));
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="project_${project._id}_export.json"`);
      return res.json(payload);
    }

    if (format === 'coco') {
      // COCO format
      const coco = {
        info: {
          description: project.description || project.name,
          version: '1.0',
          project: project.name,
          exportedAt: new Date().toISOString(),
        },
        licenses: [],
        images: [],
        annotations: [],
        categories: [],
      };

      let annId = 1;
      const labelSet = new Set();
      approvedTasks.forEach((t) => {
        const imgId = annId;
        coco.images.push({
          id: imgId,
          file_name: t.dataItem?.filename || `item_${t._id}`,
          width: t.dataItem?.width || 0,
          height: t.dataItem?.height || 0,
        });

        if (t.labels?.objects) {
          t.labels.objects.forEach((obj) => {
            const catName = obj.label || 'unknown';
            labelSet.add(catName);
            coco.annotations.push({
              id: annId++,
              image_id: imgId,
              category_id: catName,
              bbox: obj.bbox, // [x1, y1, w, h] — giả định bbox đã là pixel
              area: obj.bbox ? obj.bbox[2] * obj.bbox[3] : 0,
              iscrowd: 0,
            });
          });
        }
      });

      // Build categories from label names
      let catId = 1;
      labelSet.forEach((name) => {
        coco.categories.push({ id: catId++, name, supercategory: project.name });
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="project_${project._id}_coco.json"`);
      return res.json(coco);
    }

    if (format === 'yolo') {
      // YOLO format — trả về zip chứa folder images/ và labels/
      // Vì Node.js zip khó, trả về JSON mapping (annotations + filename)
      // Client tự chuyển sang YOLO format hoặc dùng tool bên ngoài
      const yoloData = approvedTasks.map((t) => ({
        imageFile: t.dataItem?.filename || `item_${t._id}`,
        labels: (t.labels?.objects || []).map((obj) => ({
          class: obj.label || 'unknown',
          bbox: obj.bbox, // client cần chuyển sang YOLO format (normalized)
        })),
        annotator: t.annotatorId?.fullName || t.annotatorId?.username || 'unknown',
        reviewedAt: t.reviewedAt,
      }));
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="project_${project._id}_yolo.json"`);
      return res.json({ project: projectInfo, annotations: yoloData, note: 'Bbox values are in pixels. Convert to YOLO normalized format (x_center/width, y_center/height) by dividing by image dimensions.' });
    }

    // Default: JSON
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="project_${project._id}_export.json"`);
    return res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;