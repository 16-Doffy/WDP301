import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../config/api';

const splitSentences = (text = '') =>
  text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

const ProjectTextReview = () => {
  const { id: projectId } = useParams();
  const [submissions, setSubmissions] = useState([]); // { _id, annotator, text }
  const [loading, setLoading] = useState(true);
  const [processingMap, setProcessingMap] = useState({}); // key: `${submissionId}-${idx}` => bool
  const [feedbacks, setFeedbacks] = useState({}); // key: `${submissionId}-${idx}` => string
  const [sentenceStatus, setSentenceStatus] = useState({}); // key => 'approved'|'rejected'

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        // Adjust endpoint to your backend: list text submissions for the project
        const resp = await axios.get(`${API_URL}/api/projects/${projectId}/submissions`);
        // Expect resp.data = [{ _id, annotator, text }]
        setSubmissions(resp.data || []);
      } catch (err) {
        console.error('Error fetching submissions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [projectId]);

  const setProcessing = (key, v) =>
    setProcessingMap(prev => ({ ...prev, [key]: v }));

  const handleAction = async (submissionId, idx, action) => {
    const key = `${submissionId}-${idx}`;
    // Reject requires feedback
    if (action === 'reject' && !feedbacks[key]?.trim()) {
      alert('Vui lòng nhập feedback trước khi từ chối câu này.');
      return;
    }
    if (!window.confirm(`Are you sure to ${action} this sentence?`)) return;

    setProcessing(key, true);
    try {
      // Single endpoint: adapt to your backend. Payload includes sentence index, action and optional feedback.
      await axios.post(`${API_URL}/api/reviews/${submissionId}/sentences`, {
        index: idx,
        action,
        feedback: feedbacks[key]?.trim() || undefined,
      });
      setSentenceStatus(prev => ({ ...prev, [key]: action === 'approve' ? 'approved' : 'rejected' }));
      // Optionally refresh submissions or fetch task-level info here
    } catch (err) {
      const msg = err.response?.data?.message || 'Error saving sentence review';
      alert(msg);
      console.error(err);
    } finally {
      setProcessing(key, false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (submissions.length === 0) return <div className="p-6 text-sm text-gray-500">No text submissions found for this project.</div>;

  return (
    <div className="p-6 space-y-6">
      {submissions.map((s) => {
        const sentences = splitSentences(s.text);
        return (
          <div key={s._id} className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">{s.annotator?.fullName || s.annotator?.username || 'Annotator'}</div>
                <div className="text-xs text-gray-400">Submission: {s._id}</div>
              </div>
            </div>

            <div className="space-y-3">
              {sentences.map((sent, idx) => {
                const key = `${s._id}-${idx}`;
                const status = sentenceStatus[key];
                const processing = !!processingMap[key];
                return (
                  <div key={key} className="p-3 border rounded-md">
                    <div className="text-sm mb-2">{sent}</div>

                    <textarea
                      value={feedbacks[key] || ''}
                      onChange={(e) => setFeedbacks(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Feedback (required to reject)"
                      className="w-full mb-2 p-2 border rounded resize-none text-sm"
                      rows={2}
                    />

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAction(s._id, idx, 'approve')}
                        disabled={processing || status === 'approved'}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs disabled:opacity-50"
                      >
                        Approve
                      </button>

                      <button
                        onClick={() => handleAction(s._id, idx, 'reject')}
                        disabled={processing || status === 'rejected'}
                        className="px-3 py-1 bg-rose-600 text-white rounded text-xs disabled:opacity-50"
                        title="Reject requires feedback"
                      >
                        Reject
                      </button>

                      {status && (
                        <span className={`ml-2 text-xs font-semibold ${status === 'approved' ? 'text-green-700' : 'text-rose-700'}`}>
                          {status.toUpperCase()}
                        </span>
                      )}

                      {processing && <span className="text-xs text-gray-500 ml-2">Saving...</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectTextReview;