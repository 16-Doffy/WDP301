const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const cron = require('node-cron');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/data-labeling', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/datasets', require('./routes/datasets'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/labels', require('./routes/labels'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/activity-logs', require('./routes/activityLogs').router);
app.use('/api/settings', require('./routes/settings'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/subtopics', require('./routes/subtopics'));
app.use('/api/labelsets', require('./routes/labelsets'));


// System Health API
app.get('/api/admin/system-health', (req, res) => {
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  
  // Get memory info
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  // Get upload directory size (approximate)
  let storageUsed = 0;
  const uploadsDir = path.join(__dirname, 'uploads');
  try {
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      files.forEach(file => {
        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            storageUsed += stats.size;
          }
        } catch (e) {}
      });
    }
  } catch (e) {}
  
  const storageTotal = 10 * 1024 * 1024 * 1024; // 10GB default
  
  res.json({
    server: {
      status: 'running',
      uptime: process.uptime(),
      version: '1.0.0',
      nodeVersion: process.version,
    },
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      name: 'mongodb',
      collections: 8,
    },
    memory: {
      used: Math.round(usedMemory / 1024 / 1024),
      total: Math.round(totalMemory / 1024 / 1024),
      percentage: Math.round((usedMemory / totalMemory) * 100),
    },
    storage: {
      used: Math.round(storageUsed / 1024 / 1024 / 1024 * 100) / 100,
      total: 10,
      percentage: Math.round((storageUsed / storageTotal) * 100),
    },
    api: {
      requests: Math.floor(Math.random() * 10000) + 5000,
      errors: Math.floor(Math.random() * 20),
      avgResponseTime: Math.floor(Math.random() * 100) + 50,
    },
  });
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  // Catch all handler: send back React's index.html file for client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

// ============================================================
// AUTO-FINALIZE EXPIRED PROJECTS (runs every 5 minutes)
// ============================================================
const autoFinalizeExpiredProjects = async () => {
  try {
    const Project = require('./models/Project');
    const Task = require('./models/Task');

    const now = new Date();

    // Find all active/in_review projects past deadline that are NOT finalized
    const expiredProjects = await Project.find({
      deadline: { $lte: now },
      status: { $nin: ['completed', 'archived', 'approved', 'rejected', 'expired'] }
    }).populate('managerId', 'username fullName email');

    if (expiredProjects.length === 0) return;

    const results = [];

    for (const project of expiredProjects) {
      // Check if already has review decision
      if (project.projectReview?.status && ['approved', 'rejected', 'expired'].includes(project.projectReview.status)) {
        continue; // Already finalized, skip
      }

      // Calculate final approval rate
      const tasks = await Task.find({ projectId: project._id }).select('status');
      const totalTasks = tasks.length;
      const approvedTasks = tasks.filter(t => t.status === 'approved').length;
      const rejectedTasks = tasks.filter(t => t.status === 'rejected').length;
      const expiredTasks = tasks.filter(t => t.status === 'expired').length;
      const submittedTasks = tasks.filter(t => t.status === 'submitted').length;
      const waitingReworkTasks = tasks.filter(t => ['waiting_rework', 'revised'].includes(t.status)).length;
      const pendingTasks = tasks.filter(t => ['assigned', 'in_progress'].includes(t.status)).length;

      // Mark remaining un-reviewed tasks as expired
      if (submittedTasks > 0) {
        await Task.updateMany(
          { projectId: project._id, status: 'submitted' },
          { $set: { status: 'expired' } }
        );
      }

      // Re-count after marking expired
      const finalApproved = tasks.filter(t => t.status === 'approved').length;
      const finalExpired = tasks.filter(t => ['expired', 'submitted', 'waiting_rework', 'revised', 'assigned', 'in_progress'].includes(t.status)).length;
      const approvalRate = totalTasks > 0 ? Math.round((finalApproved / totalTasks) * 10000) / 100 : 0;

      let finalStatus, finalReason;
      if (approvalRate >= 70) {
        finalStatus = 'approved';
        finalReason = 'auto-approved';
      } else {
        finalStatus = 'rejected';
        finalReason = 'auto-rejected';
      }

      project.projectReview = {
        status: finalStatus,
        reviewedBy: null, // system auto-finalized
        reviewedAt: now,
        comment: `Auto-finalized when deadline passed (${finalReason}). Approval rate: ${approvalRate}%. Approved: ${finalApproved}/${totalTasks}`,
        approvalRate,
        approvedTasks: finalApproved,
        rejectedTasks,
        expiredTasks: finalExpired,
        pendingTasks,
      };
      project.totalTasks = totalTasks;
      project.reviewedTasks = finalApproved + rejectedTasks;
      project.status = 'completed';
      await project.save();

      results.push({
        projectId: project._id.toString(),
        name: project.name,
        finalStatus,
        approvalRate,
        totalTasks,
        approvedTasks: finalApproved,
      });

      // Log activity
      try {
        const { createActivityLog } = require('./routes/activityLogs');
        await createActivityLog(
          null, // system
          `project_auto_${finalStatus}`,
          'project',
          project._id,
          `Project auto-${finalStatus} when deadline passed. Approval rate: ${approvalRate}%`,
          { approvalRate, approvedTasks: finalApproved, totalTasks, finalReason },
          null
        );
      } catch (e) {}
    }

    if (results.length > 0) {
      console.log('[CRON] Auto-finalized ' + results.length + ' projects:', results);
    }
  } catch (error) {
    console.error('[CRON] Auto-finalize error:', error);
  }
};

// Run immediately on startup, then every 5 minutes
autoFinalizeExpiredProjects();
cron.schedule('*/5 * * * *', autoFinalizeExpiredProjects);
console.log('[CRON] Auto-finalize scheduler started (runs every 5 minutes)');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
