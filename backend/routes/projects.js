const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { auth, authorize } = require('../middleware/auth');

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
router.post('/', auth, authorize('manager', 'admin'), [
  body('name').trim().notEmpty(),
  body('guidelines').trim().notEmpty(),
  body('labelSet').isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const project = new Project({
      ...req.body,
      managerId: req.user._id
    });

    await project.save();
    await project.populate('managerId', 'username fullName email');

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

    Object.assign(project, req.body);
    project.updatedAt = new Date();
    await project.save();
    await project.populate('managerId', 'username fullName email');

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
    await project.deleteOne();

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
