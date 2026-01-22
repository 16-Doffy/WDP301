const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { auth, authorize } = require('../middleware/auth');
const { createActivityLog } = require('./activityLogs');

const router = express.Router();

// Get all projects
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'manager') {
      query.managerId = req.user._id;
    }
    
    const projects = await Project.find(query)
      .populate('managerId', 'username fullName email')
      .sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get project by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('managerId', 'username fullName email');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Authorization check - Manager can only see their own projects, Admin can see all
    if (req.user.role === 'manager' && project.managerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this project' });
    }

    // Get statistics
    const stats = await Task.aggregate([
      { $match: { projectId: project._id } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);

    res.json({ project, stats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create project (Manager only)
router.post('/', auth, authorize('manager'), [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('guidelines').trim().notEmpty().withMessage('Guidelines are required'),
  body('labelSet').optional().isArray().withMessage('labelSet must be an array'),
  body('questions').optional().isArray().withMessage('questions must be an array'),
  body('reviewPolicy').optional().isObject().withMessage('reviewPolicy must be object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Validate labelSet if provided
    if (req.body.labelSet && Array.isArray(req.body.labelSet)) {
      for (const label of req.body.labelSet) {
        if (!label.name || label.name.trim() === '') {
          return res.status(400).json({ message: 'All labels must have a name' });
        }
      }
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

    const project = new Project({
      name: req.body.name.trim(),
      description: req.body.description?.trim() || '',
      guidelines: req.body.guidelines.trim(),
      labelSet: req.body.labelSet || [],
      questions: req.body.questions || [],
      managerId: req.user._id,
      status: req.body.status || 'draft',
      reviewPolicy: {
        mode: req.body.reviewPolicy?.mode || 'full',
        sampleRate: typeof req.body.reviewPolicy?.sampleRate === 'number'
          ? Math.min(1, Math.max(0, req.body.reviewPolicy.sampleRate))
          : 0.1
      },
      deadline: req.body.deadline ? new Date(req.body.deadline) : undefined,
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

    const oldName = project.name;
    Object.assign(project, req.body);

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

// Export approved tasks data (Manager only)
router.get('/:id/export', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.managerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const approvedTasks = await Task.find({
      projectId: project._id,
      status: 'approved'
    })
      .populate('annotatorId', 'username fullName')
      .populate('datasetId', 'name')
      .sort({ reviewedAt: 1 });

    if (approvedTasks.length === 0) {
      return res.status(400).json({ message: 'No approved tasks to export' });
    }

    if (format === 'json') {
      const exportData = approvedTasks.map(task => ({
        id: task._id.toString(),
        filename: task.dataItem?.filename,
        path: task.dataItem?.path,
        labels: task.labels,
        annotator: task.annotatorId?.fullName || task.annotatorId?.username,
        reviewedAt: task.reviewedAt,
        project: project.name
      }));

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${project.name}_export_${Date.now()}.json"`);
      
      // Log data export
      await createActivityLog(
        req.user._id,
        'export_data',
        'project',
        project._id,
        `Exported ${approvedTasks.length} approved tasks from project: ${project.name} (JSON format)`,
        { 
          projectId: project._id.toString(),
          format: 'json',
          tasksCount: approvedTasks.length
        },
        req
      );
      
      res.json(exportData);
    } else if (format === 'coco') {
      // COCO format export
      const cocoData = {
        info: {
          description: project.description || project.name,
          version: "1.0",
          year: new Date().getFullYear()
        },
        images: [],
        annotations: [],
        categories: project.labelSet.map((label, idx) => ({
          id: idx + 1,
          name: label.name,
          supercategory: "object"
        }))
      };

      approvedTasks.forEach((task, taskIdx) => {
        const imageId = taskIdx + 1;
        cocoData.images.push({
          id: imageId,
          file_name: task.dataItem?.filename,
          width: 0, // Would need to extract from image
          height: 0
        });

        // Convert labels to COCO format
        if (task.labels && task.labels.objects && Array.isArray(task.labels.objects)) {
          task.labels.objects.forEach((obj, annIdx) => {
            const category = cocoData.categories.find(cat => cat.name === obj.label);
            if (category && obj.bbox) {
              const [x, y, width, height] = obj.bbox;
              cocoData.annotations.push({
                id: taskIdx * 1000 + annIdx + 1,
                image_id: imageId,
                category_id: category.id,
                bbox: [x, y, width, height],
                area: width * height,
                iscrowd: 0
              });
            }
          });
        }
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${project.name}_coco_${Date.now()}.json"`);
      
      // Log data export
      await createActivityLog(
        req.user._id,
        'export_data',
        'project',
        project._id,
        `Exported ${approvedTasks.length} approved tasks from project: ${project.name} (COCO format)`,
        { 
          projectId: project._id.toString(),
          format: 'coco',
          tasksCount: approvedTasks.length
        },
        req
      );
      
      res.json(cocoData);
    } else if (format === 'csv') {
      // CSV format export
      const csvRows = ['Filename,Annotator,Labels,Reviewed At'];
      
      approvedTasks.forEach(task => {
        const labelsStr = JSON.stringify(task.labels).replace(/"/g, '""');
        const reviewedAt = task.reviewedAt ? new Date(task.reviewedAt).toISOString() : '';
        const annotator = task.annotatorId?.fullName || task.annotatorId?.username || '';
        csvRows.push(`"${task.dataItem?.filename}","${annotator}","${labelsStr}","${reviewedAt}"`);
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${project.name}_export_${Date.now()}.csv"`);
      
      // Log data export
      await createActivityLog(
        req.user._id,
        'export_data',
        'project',
        project._id,
        `Exported ${approvedTasks.length} approved tasks from project: ${project.name} (CSV format)`,
        { 
          projectId: project._id.toString(),
          format: 'csv',
          tasksCount: approvedTasks.length
        },
        req
      );
      
      res.send(csvRows.join('\n'));
    } else {
      return res.status(400).json({ message: 'Invalid format. Supported: json, csv, coco' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get quality statistics for project (Manager only)
router.get('/:id/quality', auth, authorize('manager'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.managerId.toString() !== req.user._id.toString()) {
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
          approvalRate: 0
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
      annotatorStat.approvalRate = reviewed > 0 
        ? (annotatorStat.approved / reviewed * 100).toFixed(2)
        : 0;
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Export project data (Manager only)
router.get('/:id/export', auth, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Authorization check
    if (req.user.role === 'manager' && project.managerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get all approved tasks
    const tasks = await Task.find({
      projectId: project._id,
      status: 'approved'
    })
      .populate('dataItem', 'filename path mimeType')
      .populate('annotatorId', 'username fullName');

    let exportData;
    let contentType;
    let filename;

    switch (format.toUpperCase()) {
      case 'YOLO':
        // YOLO format: class_id center_x center_y width height (normalized)
        exportData = tasks.map(task => {
          if (!task.labels?.objects || !Array.isArray(task.labels.objects)) return null;
          
          const imagePath = task.dataItem?.path || '';
          const annotations = task.labels.objects.map(obj => {
            const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
            const labelIndex = project.labelSet.findIndex(l => l.name === obj.label);
            const centerX = ((x1 + x2) / 2) / 100;
            const centerY = ((y1 + y2) / 2) / 100;
            const width = Math.abs(x2 - x1) / 100;
            const height = Math.abs(y2 - y1) / 100;
            
            return `${labelIndex} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
          }).join('\n');
          
          return `${imagePath}\n${annotations}`;
        }).filter(Boolean).join('\n\n');
        
        contentType = 'text/plain';
        filename = `project_${project._id}_yolo_${Date.now()}.txt`;
        break;

      case 'VOC':
        // Pascal VOC XML format
        const vocData = tasks.map(task => {
          if (!task.labels?.objects || !Array.isArray(task.labels.objects)) return null;
          
          const objects = task.labels.objects.map(obj => {
            const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
            return `    <object>
      <name>${obj.label}</name>
      <bndbox>
        <xmin>${Math.round(x1)}</xmin>
        <ymin>${Math.round(y1)}</ymin>
        <xmax>${Math.round(x2)}</xmax>
        <ymax>${Math.round(y2)}</ymax>
      </bndbox>
    </object>`;
          }).join('\n');
          
          return `  <image>
    <filename>${task.dataItem?.filename || 'unknown'}</filename>
    <path>${task.dataItem?.path || ''}</path>
${objects}
  </image>`;
        }).filter(Boolean).join('\n');
        
        exportData = `<?xml version="1.0"?>
<annotation>
  <project>${project.name}</project>
${vocData}
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
          categories: project.labelSet.map((label, idx) => ({
            id: idx + 1,
            name: label.name,
            supercategory: 'object'
          }))
        };

        tasks.forEach((task, taskIdx) => {
          if (task.labels?.objects && Array.isArray(task.labels.objects)) {
            task.labels.objects.forEach((obj, objIdx) => {
              const [x1, y1, x2, y2] = obj.bbox || [0, 0, 0, 0];
              const labelIndex = project.labelSet.findIndex(l => l.name === obj.label);
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
