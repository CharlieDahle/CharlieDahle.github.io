import { useState, useEffect } from 'react';
import { X, BookOpen, PenLine, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import './GuestbookModal.css';

const API_BASE = 'https://api.charliedahle.me';

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const GuestbookModal = ({ isOpen, onClose }) => {
  const [view, setView] = useState('read'); // 'read' or 'sign'
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name: '', location: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchEntries();
      setView('read');
      setSuccess(false);
      setError(null);
    }
  }, [isOpen]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/guestbook`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      // silently fail — entries just won't show
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/guestbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      setEntries((prev) => [data.entry, ...prev]);
      setForm({ name: '', location: '', message: '' });
      setSuccess(true);
      setView('read');
    } catch {
      setError('Could not reach the server. Try again later.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm({ name: '', location: '', message: '' });
    setError(null);
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="guestbook-overlay" onClick={handleClose}>
      <div className="guestbook-modal" onClick={(e) => e.stopPropagation()}>

        <div className="guestbook-header">
          <div className="guestbook-title-row">
            <BookOpen size={22} />
            <h2 className="guestbook-title">Guest Book</h2>
            {entries.length > 0 && (
              <span className="guestbook-count">{entries.length} {entries.length === 1 ? 'signature' : 'signatures'}</span>
            )}
          </div>
          <button className="guestbook-close" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="guestbook-tabs">
          <button
            className={`guestbook-tab ${view === 'read' ? 'guestbook-tab-active' : ''}`}
            onClick={() => { setView('read'); setError(null); }}
          >
            <BookOpen size={15} />
            Read
          </button>
          <button
            className={`guestbook-tab ${view === 'sign' ? 'guestbook-tab-active' : ''}`}
            onClick={() => { setView('sign'); setError(null); }}
          >
            <PenLine size={15} />
            Sign It
          </button>
        </div>

        {view === 'read' && (
          <div className="guestbook-entries">
            {success && (
              <div className="guestbook-success">
                <CheckCircle size={16} />
                Your message was added — thanks for signing!
              </div>
            )}
            {loading ? (
              <p className="guestbook-empty">Loading...</p>
            ) : entries.length === 0 ? (
              <p className="guestbook-empty">No entries yet — be the first to sign!</p>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="guestbook-entry">
                  <div className="guestbook-entry-header">
                    <span className="guestbook-entry-name">{entry.name}</span>
                    {entry.location && (
                      <span className="guestbook-entry-location">
                        <MapPin size={12} />
                        {entry.location}
                      </span>
                    )}
                    <span className="guestbook-entry-date">{formatDate(entry.created_at)}</span>
                  </div>
                  <p className="guestbook-entry-message">{entry.message}</p>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'sign' && (
          <form className="guestbook-form" onSubmit={handleSubmit}>
            {error && (
              <div className="guestbook-error">
                <AlertCircle size={15} />
                {error}
              </div>
            )}
            <div className="guestbook-field">
              <label className="guestbook-label">Name <span className="guestbook-required">*</span></label>
              <input
                className="guestbook-input"
                type="text"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="Your name"
                maxLength={50}
                disabled={submitting}
                required
              />
            </div>
            <div className="guestbook-field">
              <label className="guestbook-label">Location <span className="guestbook-optional">(optional)</span></label>
              <input
                className="guestbook-input"
                type="text"
                name="location"
                value={form.location}
                onChange={handleInputChange}
                placeholder="City, Country"
                maxLength={100}
                disabled={submitting}
              />
            </div>
            <div className="guestbook-field">
              <label className="guestbook-label">
                Message <span className="guestbook-required">*</span>
                <span className="guestbook-char-count">{form.message.length}/500</span>
              </label>
              <textarea
                className="guestbook-textarea"
                name="message"
                value={form.message}
                onChange={handleInputChange}
                placeholder="Say something nice..."
                maxLength={500}
                rows={4}
                disabled={submitting}
                required
              />
            </div>
            <button
              type="submit"
              className="guestbook-submit"
              disabled={submitting}
            >
              {submitting ? 'Signing...' : 'Sign the Book'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default GuestbookModal;
