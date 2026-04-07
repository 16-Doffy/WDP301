const fs = require('fs');
const path = require('path');

const f = path.join(__dirname, 'backend', 'routes', 'reviews.js');
let content = fs.readFileSync(f, 'utf8');

const patch = `

// Get project review stats
router.get('/projects/:id/stats', auth, authorize('reviewer', 'admin'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const reviewerId = req.user._id;
    const reviewerIdString = reviewerId.toString();
    const tasks = await Task.find({
      projectId: projectId,
      $or: [
        { reviewers: { $elemMatch: { reviewerId: { $in: [reviewerId, reviewerIdString] } } } },
        { reviewerId: { $in: [reviewerId, reviewerIdString] } },
      ],
    });
    let total = 0, pending = 0, approved = 0, rejected = 0, reviewed = 0;
    tasks.forEach((t) => {
      total++;
      if (t.status === 'submitted') pending++;
      else if (t.status === 'approved') { approved++; reviewed++; }
      else if (t.status === 'rejected') { rejected++; reviewed++; }
    });
    res.json({ total, pending, approved, rejected, reviewed });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get project subtopics breakdown
router.get('/projects/:id/subtopics', auth, authorize('reviewer', 'admin'), async (req, res) => {
  try {
    const projectId = req.params.id;
    const reviewerId = req.user._id;
    const reviewerIdString = reviewerId.toString();
    const tasks = await Task.find({
      projectId: projectId,
      $or: [
        { reviewers: { $elemMatch: { reviewerId: { $in: [reviewerId, reviewerIdString] } } } },
        { reviewerId: { $in: [reviewerId, reviewerIdString] } },
      ],
    }).populate('subtopicId', 'name guideline');
    const subMap = new Map();
    tasks.forEach((t) => {
      const subId = t.subtopicId ? t.subtopicId._id.toString() : 'unknown';
      if (!subMap.has(subId)) {
        subMap.set(subId, {
          subtopicId: subId,
          subtopicName: t.subtopicId ? t.subtopicId.name : 'Subtopic',
          guideline: t.subtopicId ? t.subtopicId.guideline : '',
          total: 0, pending: 0, approved: 0, rejected: 0,
        });
      }
      const sub = subMap.get(subId);
      sub.total++;
      if (t.status === 'submitted') sub.pending++;
      else if (t.status === 'approved') sub.approved++;
      else if (t.status === 'rejected') sub.rejected++;
    });
    res.json(Array.from(subMap.values()));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

`;

content = content.replace('module.exports = router;', patch + 'module.exports = router;');
fs.writeFileSync(f, content, 'utf8');
console.log('Done: ' + content.length + ' bytes');
