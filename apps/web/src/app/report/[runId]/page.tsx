'use client';

import { useEffect, useRef, useState } from 'react';

export default function ReportViewerPage({ params }: { params: { runId: string } }) {
  const { runId } = params;
  const [html, setHtml] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('Not authenticated. Please log in and try again.');
      return;
    }

    fetch(`/api/runs/${runId}/report`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load report (${res.status})`);
        return res.text();
      })
      .then((text) => {
        setHtml(text);
        const blob = new Blob([text], { type: 'text/html; charset=utf-8' });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch((e: Error) => setError(e.message));

    return () => {
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
    };
  }, [runId]);

  useEffect(() => {
    prevBlobUrl.current = blobUrl;
  }, [blobUrl]);

  function downloadReport() {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qa-report-${runId.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <div style={{ fontFamily: 'sans-serif', padding: 40, background: '#0a0f1e', minHeight: '100vh', color: '#ef4444' }}>
        <p style={{ marginBottom: 12 }}>Error loading report: {error}</p>
        <a href="/dashboard" style={{ color: '#6366f1', textDecoration: 'underline' }}>← Back to Dashboard</a>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0f1e' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <p>Loading report…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0f1e' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: '#0f172a', borderBottom: '1px solid #1e293b',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="javascript:history.back()" style={{ color: '#94a3b8', textDecoration: 'none', fontSize: 13, fontFamily: 'sans-serif' }}>
            ← Back
          </a>
          <span style={{ color: '#334155', fontSize: 13 }}>|</span>
          <span style={{ color: '#64748b', fontSize: 12, fontFamily: 'monospace' }}>Run {runId.slice(0, 8)}</span>
        </div>
        <button
          onClick={downloadReport}
          style={{
            background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6,
            padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'sans-serif',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ⬇ Download Report
        </button>
      </div>

      {/* Report iframe — renders the full HTML document with its own styles */}
      <iframe
        src={blobUrl}
        style={{ flex: 1, border: 'none', width: '100%' }}
        title={`QA Report ${runId}`}
      />
    </div>
  );
}
