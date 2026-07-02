import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function BulkUploadOfficers() {
  const [adminId, setAdminId] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Live per-officer progress, driven by the NDJSON stream from the backend
  // — { processed, total, percent, created, skipped, failed, lastRow }
  const [progress, setProgress] = useState(null);

  const { data: admins = [] } = useQuery({
    queryKey: ['master-admins-all'],
    queryFn: () => api.get('/master/admins?limit=100').then(r => r.data.data.data),
  });

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setFile(f);
    else toast.error('Only Excel files (.xlsx, .xls) allowed');
  };

  // Uploads via fetch() (rather than axios) so we can read the response body
  // as a stream: the backend now sends one NDJSON progress event per officer
  // row as it's processed, instead of one buffered JSON response at the end.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!adminId) { toast.error('Select an admin'); return; }
    if (!file) { toast.error('Upload an Excel file'); return; }

    setUploading(true);
    setResult(null);
    setProgress({ processed: 0, total: 0, percent: 0, created: 0, skipped: 0, failed: 0, lastRow: null });

    try {
      const fd = new FormData();
      fd.append('adminId', adminId);
      fd.append('file', file);

      const token = localStorage.getItem('accessToken');
      const base = api.defaults.baseURL || '';
      const res = await fetch(`${base}/master/officers/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        let message = 'Upload failed';
        try { message = JSON.parse(text)?.message || message; } catch { /* not JSON, use default */ }
        throw new Error(message);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let lineEnd;
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);
          if (!line) continue;

          const event = JSON.parse(line);
          if (event.type === 'start') {
            setProgress(p => ({ ...p, total: event.total }));
          } else if (event.type === 'progress') {
            setProgress({
              processed: event.processed,
              total: event.total,
              percent: event.percent,
              created: event.created,
              skipped: event.skipped,
              failed: event.failed,
              lastRow: event.lastRow,
            });
          } else if (event.type === 'done') {
            setResult(event.result);
            toast.success(`Upload complete: ${event.result.created} officers created`);
          }
        }
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const rows = [
      ['name', 'email', 'phone', 'gender', 'dateOfBirth', 'rankCode', 'badgeNumber', 'designation'],
      ['John Doe', 'john@police.gov.in', '9876543210', 'male', '1990-01-15', 'H', 'P001', 'Head Constable'],
      ['Jane Smith', 'jane@police.gov.in', '9876543211', 'female', '1992-05-20', 'G', 'P002', 'SI'],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'officers_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Upload Officers</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Upload an Excel file to add multiple officers at once</p>
      </div>

      {/* Instructions */}
      <div className="card p-5 border-l-4 border-blue-500">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-blue-500" /> Excel File Requirements
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
          <li>Required columns: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">name, email, phone, rankCode</code></li>
          <li>Optional: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">gender, dateOfBirth, badgeNumber, designation</code></li>
          <li>Phone must be 10-digit Indian mobile number</li>
          <li>rankCode must match an existing rank (e.g. A, B, C...)</li>
          <li>Duplicate emails will be skipped automatically</li>
          <li>Credentials are sent via WhatsApp automatically</li>
        </ul>
        <button onClick={downloadTemplate} className="btn-secondary mt-3 text-sm">
          <Download className="w-3.5 h-3.5" /> Download Template (CSV)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Admin selector */}
        <div className="card p-5">
          <label className="form-label">Select Admin (ACP) *</label>
          <select className="input-field" value={adminId} onChange={e => setAdminId(e.target.value)} required>
            <option value="">— Choose Admin —</option>
            {admins.filter(a => a.status === 'active').map(a => (
              <option key={a._id} value={a._id}>{a.name} ({a.email})</option>
            ))}
          </select>
          {admins.filter(a => a.status !== 'active').length > 0 && (
            <p className="text-xs text-gray-400 mt-1">Suspended admins are excluded</p>
          )}
        </div>

        {/* File drop zone */}
        <div className="card p-5">
          <label className="form-label">Excel File (.xlsx / .xls) *</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
            className={`mt-1 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragging ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <input
              id="file-input" type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => setFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="w-10 h-10 text-green-500" />
                <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-xs text-red-500 hover:underline">Remove</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-10 h-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Drag & drop or click to upload</p>
                <p className="text-xs text-gray-400">Supports .xlsx, .xls</p>
              </div>
            )}
          </div>
        </div>

        <button type="submit" disabled={uploading || !file || !adminId} className="btn-primary w-full justify-center py-2.5">
          {uploading ? 'Uploading...' : <><Upload className="w-4 h-4" /> Upload Officers</>}
        </button>
      </form>

      {/* Live progress bar — how many officers have been processed so far */}
      {uploading && progress && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Uploading officers{progress.total > 0 && ` — ${progress.processed} / ${progress.total}`}
            </p>
            <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{progress.percent || 0}%</p>
          </div>
          <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress.percent || 0}%` }}
            />
          </div>
          {progress.lastRow && (
            <p className="text-xs text-gray-400 truncate">Last processed: {progress.lastRow}</p>
          )}
          <div className="flex gap-4 text-xs">
            <span className="text-green-600 dark:text-green-400 font-medium">{progress.created || 0} created</span>
            <span className="text-yellow-600 dark:text-yellow-400 font-medium">{progress.skipped || 0} skipped</span>
            <span className="text-red-600 dark:text-red-400 font-medium">{progress.failed || 0} failed</span>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Upload Results</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-600">{result.created}</p>
              <p className="text-xs text-green-600">Created</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
              <AlertCircle className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
              <p className="text-xs text-yellow-600">Skipped (duplicates)</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-600">{result.failed?.length || 0}</p>
              <p className="text-xs text-red-600">Failed</p>
            </div>
          </div>
          {result.failed?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Failed Entries:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <div key={i} className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded px-3 py-1.5">
                    <span className="font-medium">{f.row}</span>: {f.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}