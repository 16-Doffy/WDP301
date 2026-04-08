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
router.post('/:id/review-decision', auth, authorize('reviewer', 'admin'), async (req, res) => {
  try {
    const { status, comment } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be approved or rejected' });
    }

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const snapshot = await computeProjectReviewSnapshot(project._id);
    if (snapshot.actionableLeft > 0) {
      return res.status(400).json({
        message: 'Cannot finalize project decision yet. Some tasks are still pending/submitted.',
        snapshot,
      });
    }

    project.projectReview = {
      status,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      comment: (comment || '').trim(),
    };
    await project.save();

    await project.populate('projectReview.reviewedBy', 'username fullName');

    res.json({
      message: `Project marked as ${status}`,
      project,
      projectReviewSnapshot: snapshot,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export project data (Manager only)
router.get('/:id/export', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const project = await Project.findById(req.params.id).select('name description managerId');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Authorization check - Manager can only export their own projects, Admin can export all
    if (req.user.role === 'manager' && project.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    // Admin can export any project (no additional check needed)

    // Get all tasks in the project to check completion status
    const allTasks = await Task.find({
      projectId: project._id
    });

    // Check if all tasks are approved (required for export)
    const totalTasks = allTasks.length;
    const approvedTasks = allTasks.filter(t => t.status === 'approved');
    const pendingTasks = allTasks.filter(t => t.status === 'submitted' || t.status === 'in_progress' || t.status === 'assigned');
    const rejectedTasks = allTasks.filter(t => t.status === 'rejected');

    if (totalTasks === 0) {
      return res.status(400).json({ message: 'No tasks found in this project.' });
    }

    if (approvedTasks.length === 0) {
      return res.status(400).json({ 
        message: 'No approved tasks to export. Please wait for reviewer to approve tasks.'
      });
    }

    // Check if all tasks are approved (strict requirement)
    if (pendingTasks.length > 0 || rejectedTasks.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot export: Not all tasks have been approved. All tasks must be approved before export.',
        stats: {
          total: totalTasks,
          approved: approvedTasks.length,
          pending: pendingTasks.length,
          rejected: rejectedTasks.length
        }
      });
    }

    // Get approved tasks with populated data
    const tasks = await Task.find({
      projectId: project._id,
      status: 'approved'
    })
      .populate('annotatorId', 'username fullName');

    // Build projectLabels from task availableLabels (all tasks should have the same labels)
    const projectLabels = [];
    const labelNameSet = new Set();
    for (const task of tasks) {
      if (task.availableLabels && Array.isArray(task.availableLabels)) {
        for (const lbl of task.availableLabels) {
          if (!labelNameSet.has(lbl.name)) {
            labelNameSet.add(lbl.name);
            projectLabels.push(lbl);
          }
        }
      }
    }

    let exportData;
    let contentType;
    let filename;

    switch (format.toUpperCase()) {
      case 'YOLO':
        // YOLO format: class_id center_x center_y width height (normalized)
        const yoloFiles = tasks.map(task => {
          if (!task.labels?.objects || !Array.isArray(task.labels.objects) || task.labels.objects.length === 0) {
            return null;
          }
          
          const imagePath = task.dataItem?.path || '';
          const annotations = task.labels.objects.map(obj => {
            const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
            const labelIndex = projectLabels.findIndex(l => l.name === obj.label);
            
            if (labelIndex === -1) {
              return null;
            }
            
            const centerX = ((x1 + x2) / 2) / 100;
            const centerY = ((y1 + y2) / 2) / 100;
            const width = Math.abs(x2 - x1) / 100;
            const height = Math.abs(y2 - y1) / 100;
            
            return `${labelIndex} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
          }).filter(Boolean);
          
          if (!annotations || annotations.length === 0) {
            return null;
          }
          
          return `${imagePath}\n${annotations.join('\n')}`;
        }).filter(Boolean);
        
        if (yoloFiles.length === 0) {
          return res.status(400).json({ message: 'No valid annotations found in approved tasks for YOLO export.' });
        }
        
        exportData = yoloFiles.join('\n\n');
        contentType = 'text/plain';
        filename = `project_${project._id}_yolo_${Date.now()}.txt`;
        break;

      case 'VOC':
        // Pascal VOC XML format
        const vocData = tasks.map(task => {
          if (!task.labels?.objects || !Array.isArray(task.labels.objects) || task.labels.objects.length === 0) {
            return null;
          }
          
          const objects = task.labels.objects.map(obj => {
            const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
            // Escape XML special characters in label name
            const escapedLabel = (obj.label || 'unknown')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&apos;');
            
            return `    <object>
      <name>${escapedLabel}</name>
      <bndbox>
        <xmin>${Math.round(x1)}</xmin>
        <ymin>${Math.round(y1)}</ymin>
        <xmax>${Math.round(x2)}</xmax>
        <ymax>${Math.round(y2)}</ymax>
      </bndbox>
    </object>`;
          }).join('\n');
          
          if (!objects) return null;
          
          // Escape XML special characters in filename and path
          const escapedFilename = (task.dataItem?.filename || 'unknown')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          const escapedPath = (task.dataItem?.path || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
          
          return `  <image>
    <filename>${escapedFilename}</filename>
    <path>${escapedPath}</path>
${objects}
  </image>`;
        }).filter(Boolean);
        
        if (vocData.length === 0) {
          return res.status(400).json({ message: 'No valid annotations found in approved tasks for VOC export.' });
        }
        
        // Escape XML special characters in project name
        const escapedProjectName = (project.name || 'Project')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
        
        exportData = `<?xml version="1.0" encoding="UTF-8"?>
<annotation>
  <project>${escapedProjectName}</project>
${vocData.join('\n')}
</annotation>`;
        
        contentType = 'application/xml';
        filename = `project_${project._id}_voc_${Date.now()}.xml`;
        break;

      case 'COCO':
        // COCO JSON format
        const cocoData = {
          info: {
            description: project.description || '',
            version: '1.0',
            year: new Date().getFullYear()
          },
          images: tasks.map((task, idx) => ({
            id: idx + 1,
            file_name: task.dataItem?.filename || 'unknown',
            width: 0, // Would need actual image dimensions
            height: 0
          })),
          annotations: [],
          categories: projectLabels.map((label, idx) => ({
            id: idx + 1,
            name: label.name,
            supercategory: 'object'
          }))
        };

        tasks.forEach((task, taskIdx) => {
          if (task.labels?.objects && Array.isArray(task.labels.objects)) {
            task.labels.objects.forEach((obj, objIdx) => {
              const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
              const labelIndex = projectLabels.findIndex(l => l.name === obj.label);
              cocoData.annotations.push({
                id: (taskIdx + 1) * 1000 + objIdx + 1,
                image_id: taskIdx + 1,
                category_id: labelIndex >= 0 ? labelIndex + 1 : 1,
                bbox: [x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1)],
                area: Math.abs(x2 - x1) * Math.abs(y2 - y1),
                iscrowd: 0
              });
            });
          }
        });

        exportData = JSON.stringify(cocoData, null, 2);
        contentType = 'application/json';
        filename = `project_${project._id}_coco_${Date.now()}.json`;
        break;

      case 'CSV':
        // CSV format
        const csvRows = ['Image,Label,X1,Y1,X2,Y2,Annotator'];
        tasks.forEach(task => {
          if (task.labels?.objects && Array.isArray(task.labels.objects)) {
            task.labels.objects.forEach(obj => {
              const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
              csvRows.push(`${task.dataItem?.filename || 'unknown'},${obj.label},${x1},${y1},${x2},${y2},${task.annotatorId?.username || 'unknown'}`);
            });
          }
        });
        exportData = csvRows.join('\n');
        contentType = 'text/csv';
        filename = `project_${project._id}_csv_${Date.now()}.csv`;
        break;

      default: // JSON
        exportData = JSON.stringify({
          project: {
            id: project._id,
            name: project.name,
            description: project.description,
            exportFormat: project.exportFormat || 'JSON'
          },
          tasks: tasks.map(task => ({
            id: task._id,
            image: task.dataItem?.filename || 'unknown',
            path: task.dataItem?.path || '',
            annotations: task.labels?.objects || [],
            annotator: task.annotatorId?.username || 'unknown',
            reviewedAt: task.reviewedAt
          }))
        }, null, 2);
        contentType = 'application/json';
        filename = `project_${project._id}_json_${Date.now()}.json`;
    }

    // Ensure exportData is not null or undefined
    if (exportData === null || exportData === undefined) {
      return res.status(400).json({ message: 'Failed to generate export data. Please check your project data.' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);

    // Log export activity
    await createActivityLog(
      req.user._id,
      'project_export',
      'project',
      project._id,
      `Exported project data in ${format.toUpperCase()} format`,
      { format: format.toUpperCase(), tasksCount: tasks.length },
      req
    );
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;