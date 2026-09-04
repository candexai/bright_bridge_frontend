import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { User, School, Loader2, AlertCircle, Check, Trash2, CheckCircle } from 'lucide-react';

interface AiNumberRequest {
  _id: string;
  schoolId: {
    _id: string;
    name: string;
    email?: string;
  } | null;
  requestedBy: {
    _id: string;
    name: string;
    email: string;
  } | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  assignedAiNumber?: string;
  adminNotes?: string;
  notes?: string;
  isRead?: boolean;
}

const AiNumberRequests = () => {
  const [requests, setRequests] = useState<AiNumberRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchRequests = async () => {
    try {
      const res = await api.get('/admin/ai-number-requests');
      setRequests(res.data);
    } catch (err) {
      console.error('Failed to fetch AI number requests:', err);
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleMarkAsRead = async (requestId: string) => {
    setProcessing(requestId);
    try {
      await api.put(`/admin/ai-number-requests/${requestId}/mark-read`);
      setRequests(prev => prev.map(req => 
        req._id === requestId ? { ...req, isRead: true } : req
      ));
      setSuccess('Request marked as read');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mark as read');
    } finally {
      setProcessing(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all AI number requests? This action cannot be undone.')) return;
    
    setProcessing('clear-all');
    try {
      await api.delete('/admin/ai-number-requests');
      setRequests([]);
      setSuccess('All requests cleared successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to clear requests');
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">AI Number Requests</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage AI phone number requests from schools</p>
        </div>
        <button
          onClick={handleClearAll}
          disabled={processing === 'clear-all' || requests.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {processing === 'clear-all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Clear All
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-lg mb-4">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}
      
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-lg mb-4">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button type="button" onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700" aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 border-b border-slate-100 bg-slate-50">
              <th className="px-5 py-3">School</th>
              <th className="px-5 py-3">Requested By</th>
              <th className="px-5 py-3">Requested At</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((request) => (
              <tr key={request._id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <School className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{request.schoolId?.name || 'Deleted school'}</p>
                      {request.schoolId?.email && (
                        <p className="text-xs text-slate-500">{request.schoolId.email}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{request.requestedBy?.name || 'Deleted user'}</p>
                      {request.requestedBy?.email && (
                        <p className="text-xs text-slate-500">{request.requestedBy.email}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-slate-600">
                  {formatDate(request.requestedAt)}
                </td>
                <td className="px-5 py-3">
                  {!request.isRead && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 mr-2">
                      New
                    </span>
                  )}
                  <button
                    onClick={() => handleMarkAsRead(request._id)}
                    disabled={processing === request._id || request.isRead}
                    className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 disabled:text-slate-400 disabled:bg-slate-50 rounded-lg transition-colors"
                    title={request.isRead ? "Already read" : "Mark as read"}
                  >
                    {processing === request._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">
                  No AI number requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AiNumberRequests;
