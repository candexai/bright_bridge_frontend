import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';

interface FormQuestion {
  id: string;
  question: string;
  required: boolean;
}

export const InquiryForm = () => {
  const { schoolId } = useParams<{ schoolId: string }>();
  const [schoolName, setSchoolName] = useState('');
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<{ parentName: string; email: string; phone: string;[key: string]: string }>({
    parentName: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    if (!schoolId) {
      setError('Invalid link');
      setLoading(false);
      return;
    }
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    fetch(`${base}/public/inquiry/${schoolId}/forms`)
      .then((res) => {
        if (!res.ok) throw new Error('Form not found');
        return res.json();
      })
      .then((data) => {
        setSchoolName(data.schoolName || 'School');
        setQuestions(data.questions || []);
        const initial = { parentName: '', email: '', phone: '' } as { parentName: string; email: string; phone: string;[key: string]: string };
        data.questions?.forEach((q: FormQuestion) => {
          initial[`q_${q.id}`] = '';
        });
        setFormData(initial);
      })
      .catch(() => setError('Form not found'))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolId) return;
    setSubmitting(true);
    setError('');
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
    const answers = questions.map((q) => ({
      questionId: q.id,
      question: q.question,
      value: formData[`q_${q.id}`] ?? '',
    }));
    try {
      const res = await fetch(`${base}/public/inquiry/${schoolId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: formData.parentName,
          email: formData.email,
          phone: formData.phone,
          answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Form not found</h1>
          <p className="text-slate-500 text-sm mb-6">{error}</p>
          <a href="/" className="text-blue-600 font-medium text-sm hover:underline">
            Return home
          </a>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Thank you</h1>
          <p className="text-slate-600 text-sm mb-6">
            Your inquiry has been submitted. {schoolName} will be in touch soon.
          </p>
          <a href="/" className="text-blue-600 font-medium text-sm hover:underline">
            Return home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h1 className="text-lg font-semibold text-slate-900">Enrollment inquiry</h1>
            <p className="text-sm text-slate-500 mt-0.5">{schoolName}</p>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your name</label>
              <input
                type="text"
                value={formData.parentName}
                onChange={(e) => handleChange('parentName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Parent or guardian name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+1 234 567 8900"
              />
            </div>

            {questions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {q.question}
                  {q.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                <input
                  type="text"
                  value={formData[`q_${q.id}`] ?? ''}
                  onChange={(e) => handleChange(`q_${q.id}`, e.target.value)}
                  required={q.required}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your answer"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {submitting ? 'Submitting...' : 'Submit inquiry'}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-400 text-xs mt-6">
          Powered by BrightBridge
        </p>
      </div>
    </div>
  );
};
