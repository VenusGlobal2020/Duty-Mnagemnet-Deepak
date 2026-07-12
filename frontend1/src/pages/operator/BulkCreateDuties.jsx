import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, Download, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

// Bulk duty creation via Excel. One row = one officer assigned to a duty;
// rows that share the same `dutyGroupId` belong to the same duty. This lets
// a single duty needing several officers be expressed as several rows,
// while still allowing every duty-level field (name, location, dates,
// priority, etc.) to be entered once per group.
export default function BulkCreateDuties() {
  const { user } = useAuth();
  const isSpecial = user?.role === 'operator_special';

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  const { data: ranks = [] } = useQuery({
    queryKey: ['operator-ranks-bulk'],
    queryFn: () => api.get('/operator/ranks/availability').then(r => r.data.data.ranks),
  });

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setFile(f);
    else toast.error('Only Excel files (.xlsx, .xls) allowed');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Upload an Excel file'); return; }

    setUploading(true);
    setResult(null);
    setProgress({ processed: 0, total: 0, percent: 0, created: 0, failed: 0, officersAssigned: 0, lastGroup: null });

    try {
      const fd = new FormData();
      fd.append('file', file);

      const token = localStorage.getItem('accessToken');
      const base = api.defaults.baseURL || '';
      const res = await fetch(`${base}/operator/duties/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        let message = 'Upload failed';
        try { message = JSON.parse(text)?.message || message; } catch { /* not JSON */ }
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
              failed: event.failed,
              officersAssigned: event.officersAssigned,
              lastGroup: event.lastGroup,
            });
          } else if (event.type === 'done') {
            setResult(event.result);
            toast.success(`Upload complete: ${event.result.created} duties created`);
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
    const headers = [
      'dutyGroupId', 'dutyName', 'locationName', 'lat', 'lng',
      ...(isSpecial ? ['dutyType', 'sourceLat', 'sourceLng', 'destLat', 'destLng'] : []),
      'startDate', 'endDate', 'priority', 'description', 'vehicleNumber', 'phoneNumbers',
      'officerBadgeNumber', 'officerEmail',
    ];

    const sampleRankCode = ranks?.[0]?.code || 'H';
    const rows = [headers];

    // Duty 1 — a normal (non-mobility) duty with 2 officers -> 2 rows sharing dutyGroupId "D1"
    rows.push([
      'D1', 'Republic Day Parade Security', 'Red Fort, Delhi', '28.6562', '77.2410',
      ...(isSpecial ? ['VVIP', '', '', '', ''] : []),
      '2026-01-26T06:00', '2026-01-26T14:00', '1', 'VVIP security detail for parade', 'DL01AB1234', '9876543210,9876543211',
      'P001', '',
    ]);
    rows.push([
      'D1', '', '', '', '',
      ...(isSpecial ? ['', '', '', '', ''] : []),
      '', '', '', '', '', '',
      'P002', '',
    ]);

    // Duty 2 — single officer, identified by email instead of badge number
    rows.push([
      'D2', 'Market Patrol', 'Sadar Bazaar, Delhi', '28.6600', '77.2100',
      ...(isSpecial ? ['CITY-POINT', '', '', '', ''] : []),
      '2026-01-27T09:00', '2026-01-27T17:00', '2', 'Routine patrol duty', '', '',
      '', 'officer3@police.gov.in',
    ]);

    if (isSpecial) {
      // Duty 3 — MOBILITY duty (special operators only): uses source/dest instead of lat/lng
      rows.push([
        'D3', 'VIP Escort Convoy', 'IGI Airport to Rashtrapati Bhavan', '', '',
        'MOBILITY', '28.5562', '77.1000', '28.6144', '77.2090',
        '2026-01-28T10:00', '2026-01-28T12:00', '1', 'Escort convoy for VIP arrival', 'DL01CD5678', '',
        'P003', '',
      ]);
    }

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bulk_duty_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Create Duties</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Upload an Excel file to create multiple duties — with officers assigned — in one go</p>
      </div>

      {/* Notice box explaining the format */}
      <div className="card p-5 border-l-4 border-blue-500">
        <h3 className="font-semibold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-500" /> How the Excel Format Works
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 list-disc list-inside">
          <li>
            Each row assigns <span className="font-medium">one officer</span> to a duty. If a duty needs 3 officers, use 3 rows.
          </li>
          <li>
            Rows belonging to the same duty must share the same <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">dutyGroupId</code> value
            (e.g. "D1"). Duty details (name, location, dates, priority) only need to be filled once per group — extra rows in the
            same group can leave those columns blank.
          </li>
          <li>
            Required duty columns: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">dutyGroupId, dutyName, locationName, startDate, endDate, priority</code>,
            plus <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">lat, lng</code> (unless it's a MOBILITY duty).
          </li>
          <li>
            Identify the officer per row using either <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">officerBadgeNumber</code> or{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">officerEmail</code> — only one is needed.
          </li>
          <li>Dates use the format <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">YYYY-MM-DDTHH:mm</code> (24-hour).</li>
          <li><code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">phoneNumbers</code> is optional — comma-separated numbers to notify with duty info.</li>
          {isSpecial && (
            <li>
              For a <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">MOBILITY</code> duty, leave <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">lat/lng</code> blank
              and fill <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">sourceLat, sourceLng, destLat, destLng</code> instead.
            </li>
          )}
          <li>Officers already assigned elsewhere (or duplicated within the same file) are skipped and reported after upload.</li>
        </ul>
        <button onClick={downloadTemplate} className="btn-secondary mt-3 text-sm">
          <Download className="w-3.5 h-3.5" /> Download Example Template (CSV)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card p-5">
          <label className="form-label">Excel File (.xlsx / .xls) *</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('duty-file-input').click()}
            className={`mt-1 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragging ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-300 dark:border-gray-700 hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <input id="duty-file-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={e => setFile(e.target.files[0])} />
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

        <button type="submit" disabled={uploading || !file} className="btn-primary w-full justify-center py-2.5">
          {uploading ? 'Uploading...' : <><Upload className="w-4 h-4" /> Upload &amp; Create Duties</>}
        </button>
      </form>

      {uploading && progress && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Creating duties{progress.total > 0 && ` — ${progress.processed} / ${progress.total}`}
            </p>
            <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{progress.percent || 0}%</p>
          </div>
          <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div className="h-full bg-primary-600 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress.percent || 0}%` }} />
          </div>
          {progress.lastGroup && <p className="text-xs text-gray-400 truncate">Last processed duty group: {progress.lastGroup}</p>}
          <div className="flex gap-4 text-xs">
            <span className="text-green-600 dark:text-green-400 font-medium">{progress.created || 0} duties created</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium">{progress.officersAssigned || 0} officers assigned</span>
            <span className="text-red-600 dark:text-red-400 font-medium">{progress.failed || 0} failed</span>
          </div>
        </div>
      )}

      {result && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Upload Results</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-600">{result.created}</p>
              <p className="text-xs text-green-600">Duties Created</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <CheckCircle className="w-6 h-6 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-600">{result.officersAssigned}</p>
              <p className="text-xs text-blue-600">Officers Assigned</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-600">{result.failed?.length || 0}</p>
              <p className="text-xs text-red-600">Duties Failed</p>
            </div>
          </div>

          {result.officersSkipped?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-yellow-500" /> Officers Skipped ({result.officersSkipped.length}):
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.officersSkipped.map((s, i) => (
                  <div key={i} className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded px-3 py-1.5">
                    <span className="font-medium">Group {s.dutyGroupId}</span> — {s.identifier}: {s.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.failed?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Failed Duty Groups:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {result.failed.map((f, i) => (
                  <div key={i} className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded px-3 py-1.5">
                    <span className="font-medium">Group {f.dutyGroupId}</span>: {f.reason}
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