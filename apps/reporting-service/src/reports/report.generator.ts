import { Injectable } from '@nestjs/common';
import type {
  RunSummary,
  Issue,
  AccessibilityResult,
  PerformanceResult,
  SecurityResult,
  CodeQualityResult,
} from '@qa-platform/shared-types';
import { scoreToColor, formatDate } from '@qa-platform/shared-utils';

interface ReportData {
  runId: string;
  projectId: string;
  summary: RunSummary;
  issues: Issue[];
  accessibility?: AccessibilityResult;
  performance?: PerformanceResult;
  security?: SecurityResult;
  codeQuality?: CodeQualityResult;
}

@Injectable()
export class ReportGenerator {
  async generateHtml(data: ReportData): Promise<string> {
    const { summary, issues, runId } = data;

    const sc = (score?: number) => score !== undefined ? scoreToColor(score) : '#64748b';
    const pct = (n?: number) => n !== undefined ? `${Math.round(n)}` : '—';
    const ms2s = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
    const skipped = (result: any) => !result || result?.metadata?.skipped === true;

    const sev = (s: string) => {
      const c: Record<string, string> = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#64748b' };
      return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;background:${(c[s] ?? '#64748b')}22;color:${c[s] ?? '#64748b'};border:1px solid ${(c[s] ?? '#64748b')}44">${s}</span>`;
    };

    const scoreCard = (label: string, score: number | undefined, sub = '') => `
      <div style="background:#0f172a;border:1px solid ${sc(score)}44;border-radius:12px;padding:20px;text-align:center;min-width:120px">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${label}</div>
        <div style="font-size:40px;font-weight:800;color:${sc(score)};line-height:1">${pct(score)}</div>
        ${sub ? `<div style="font-size:11px;color:#475569;margin-top:4px">${sub}</div>` : ''}
      </div>`;

    const section = (id: string, icon: string, title: string, body: string, score?: number) => `
      <div id="${id}" style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:28px;margin-bottom:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #1e293b">
          <h2 style="font-size:17px;font-weight:700;display:flex;align-items:center;gap:10px">${icon} ${title}</h2>
          ${score !== undefined ? `<span style="font-size:22px;font-weight:800;color:${sc(score)}">${pct(score)}<span style="font-size:13px;color:#475569;font-weight:400">/100</span></span>` : ''}
        </div>
        ${body}
      </div>`;

    const notTested = `<p style="color:#475569;font-size:14px;font-style:italic;padding:12px 0">⚠ Not tested — no preview URL is configured for this project. Add a Preview URL in project settings to enable this test.</p>`;

    const issueRow = (issue: Issue) => `
      <div style="border:1px solid #1e293b;border-radius:8px;padding:16px;margin-bottom:12px;border-left:4px solid ${{ critical:'#ef4444',high:'#f97316',medium:'#f59e0b',low:'#3b82f6',info:'#64748b' }[issue.severity] ?? '#64748b'}">
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px">
          ${sev(issue.severity)}
          <strong style="font-size:14px;color:#e2e8f0;flex:1">${issue.title}</strong>
        </div>
        <p style="font-size:13px;color:#94a3b8;margin-bottom:8px;line-height:1.6">${issue.description}</p>
        ${issue.location ? `<p style="font-size:11px;color:#475569;font-family:monospace;margin-bottom:8px">📍 ${issue.location}</p>` : ''}
        ${issue.suggestedFix ? `<div style="background:#1e293b;border-left:3px solid #6366f1;padding:10px 14px;border-radius:6px;font-size:12px;color:#a5b4fc;margin-bottom:6px">💡 <strong>Suggested fix:</strong> ${issue.suggestedFix}</div>` : ''}
        ${issue.aiSuggestedFix ? `<div style="background:#1e293b;border-left:3px solid #f59e0b;padding:10px 14px;border-radius:6px;font-size:12px;color:#fcd34d">🤖 <strong>AI fix:</strong> ${issue.aiSuggestedFix}</div>` : ''}
      </div>`;

    // ── Tested status table ─────────────────────────────────────────────────
    const testedRows = [
      { name: 'Accessibility',     tested: !skipped(data.accessibility), score: data.accessibility?.score, note: skipped(data.accessibility) ? 'No preview URL' : `${data.accessibility?.violations?.length ?? 0} violations` },
      { name: 'Performance',       tested: !skipped(data.performance) && (data.performance?.metrics?.lcp ?? 0) > 0, score: data.performance?.score, note: (skipped(data.performance) || (data.performance?.metrics?.lcp ?? 0) === 0) ? 'No preview URL' : `LCP ${ms2s(data.performance!.metrics.lcp)}` },
      { name: 'Security Scan',     tested: !skipped(data.security),   score: data.security?.score,   note: skipped(data.security) ? 'No preview URL' : `${(data.security as any)?.alerts?.length ?? 0} alerts` },
      { name: 'Code Quality',      tested: !!data.codeQuality,        score: data.codeQuality?.score, note: data.codeQuality ? `Rating ${data.codeQuality.rating}` : 'No repository URL' },
    ].map(r => `
      <tr>
        <td style="padding:10px 14px;font-size:13px;color:#e2e8f0">${r.name}</td>
        <td style="padding:10px 14px;text-align:center">${r.tested ? '<span style="color:#22c55e;font-size:16px">✓</span>' : '<span style="color:#475569;font-size:13px">—</span>'}</td>
        <td style="padding:10px 14px;text-align:center;font-weight:700;color:${sc(r.score)}">${r.score !== undefined ? r.score : '—'}</td>
        <td style="padding:10px 14px;font-size:12px;color:#64748b">${r.note}</td>
      </tr>`).join('');

    // ── Accessibility ────────────────────────────────────────────────────────
    const a11yBody = skipped(data.accessibility) ? notTested : (() => {
      const a = data.accessibility!;
      const violations = a.violations ?? [];
      const impactColor: Record<string, string> = { critical: '#ef4444', serious: '#f97316', moderate: '#f59e0b', minor: '#3b82f6' };
      return `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
          ${[
            { label: 'Violations', value: String(violations.length), color: violations.length === 0 ? '#22c55e' : '#ef4444' },
            { label: 'Passes', value: String(a.passes), color: '#22c55e' },
            { label: 'Incomplete', value: String(a.incomplete), color: '#f59e0b' },
            { label: 'WCAG Level', value: a.wcagLevel, color: '#6366f1' },
          ].map(m => `<div style="background:#1e293b;border-radius:8px;padding:14px;text-align:center"><div style="font-size:24px;font-weight:700;color:${m.color}">${m.value}</div><div style="font-size:11px;color:#64748b;margin-top:4px">${m.label}</div></div>`).join('')}
        </div>
        ${violations.length === 0
          ? '<p style="color:#22c55e;font-size:14px">✓ No accessibility violations found. Great job!</p>'
          : violations.map(v => `
        <div style="border:1px solid #1e293b;border-radius:8px;margin-bottom:12px;overflow:hidden">
          <div style="padding:12px 16px;background:#1e293b;display:flex;align-items:center;justify-content:space-between;border-left:4px solid ${impactColor[v.impact] ?? '#64748b'}">
            <div>
              <span style="font-size:11px;font-weight:700;color:${impactColor[v.impact] ?? '#64748b'};text-transform:uppercase;margin-right:8px">${v.impact}</span>
              <strong style="font-size:14px;color:#e2e8f0">${v.help}</strong>
            </div>
            <a href="${v.helpUrl}" style="font-size:11px;color:#6366f1;text-decoration:none" target="_blank">Docs ↗</a>
          </div>
          <div style="padding:14px 16px">
            <p style="font-size:13px;color:#94a3b8;margin-bottom:10px">${v.description}</p>
            ${v.wcagCriteria.length > 0 ? `<p style="font-size:11px;color:#475569;margin-bottom:10px">WCAG: ${v.wcagCriteria.join(', ')}</p>` : ''}
            <p style="font-size:12px;color:#64748b;margin-bottom:8px">Affects <strong style="color:#e2e8f0">${v.nodes.length}</strong> element(s):</p>
            ${v.nodes.slice(0, 3).map(n => `
            <div style="background:#0a0f1e;border-radius:6px;padding:10px;margin-bottom:6px;font-size:11px;font-family:monospace">
              <div style="color:#94a3b8;margin-bottom:4px">Target: <span style="color:#6366f1">${Array.isArray(n.target) ? n.target.join(', ') : n.target}</span></div>
              <div style="color:#64748b;word-break:break-all">${n.html?.slice(0, 200) ?? ''}</div>
              ${n.failureSummary ? `<div style="color:#f59e0b;margin-top:6px;font-style:italic;font-family:sans-serif;font-size:11px">${n.failureSummary?.slice(0, 200) ?? ''}</div>` : ''}
            </div>`).join('')}
            ${v.nodes.length > 3 ? `<p style="font-size:11px;color:#475569">… and ${v.nodes.length - 3} more elements</p>` : ''}
          </div>
        </div>`).join('')}`;
    })();

    // ── Performance ──────────────────────────────────────────────────────────
    const hasRealPerf = data.performance && !skipped(data.performance) && (data.performance.metrics.lcp > 0);
    const perfBody = !hasRealPerf ? notTested : (() => {
      const p = data.performance!;
      const m = p.metrics;
      const good = (v: number, good: number, ok: number) => v <= good ? '#22c55e' : v <= ok ? '#f59e0b' : '#ef4444';
      return `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
          ${[
            { label: 'Performance', value: pct(m.performanceScore), color: sc(m.performanceScore) },
            { label: 'Accessibility', value: pct(m.accessibilityScore), color: sc(m.accessibilityScore) },
            { label: 'Best Practices', value: pct(m.bestPracticesScore), color: sc(m.bestPracticesScore) },
            { label: 'SEO', value: pct(m.seoScore), color: sc(m.seoScore) },
          ].map(x => `<div style="background:#1e293b;border-radius:8px;padding:14px;text-align:center"><div style="font-size:26px;font-weight:800;color:${x.color}">${x.value}</div><div style="font-size:11px;color:#64748b;margin-top:4px">${x.label}</div></div>`).join('')}
        </div>
        <h3 style="font-size:13px;font-weight:600;color:#94a3b8;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">Core Web Vitals</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
          ${[
            { label: 'LCP (Largest Contentful Paint)', value: ms2s(m.lcp), color: good(m.lcp, 2500, 4000), threshold: 'Good < 2.5s' },
            { label: 'CLS (Cumulative Layout Shift)', value: m.cls.toFixed(3), color: good(m.cls, 0.1, 0.25), threshold: 'Good < 0.1' },
            { label: 'FID (First Input Delay)', value: `${m.fid}ms`, color: good(m.fid, 100, 300), threshold: 'Good < 100ms' },
            { label: 'FCP (First Contentful Paint)', value: ms2s(m.fcp), color: good(m.fcp, 1800, 3000), threshold: 'Good < 1.8s' },
            { label: 'TTI (Time to Interactive)', value: ms2s(m.tti), color: good(m.tti, 3800, 7300), threshold: 'Good < 3.8s' },
            { label: 'TBT (Total Blocking Time)', value: `${m.tbt}ms`, color: good(m.tbt, 200, 600), threshold: 'Good < 200ms' },
          ].map(x => `
          <div style="background:#1e293b;border-radius:8px;padding:14px">
            <div style="font-size:24px;font-weight:700;color:${x.color};margin-bottom:4px">${x.value}</div>
            <div style="font-size:12px;color:#94a3b8;margin-bottom:2px">${x.label}</div>
            <div style="font-size:10px;color:#475569">${x.threshold}</div>
          </div>`).join('')}
        </div>
        ${p.opportunities && p.opportunities.length > 0 ? `
        <h3 style="font-size:13px;font-weight:600;color:#94a3b8;margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em">Opportunities</h3>
        ${p.opportunities.map(o => `
        <div style="background:#1e293b;border-radius:8px;padding:14px;margin-bottom:8px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div style="flex:1">
            <strong style="font-size:13px;color:#e2e8f0">${o.title}</strong>
            <p style="font-size:12px;color:#94a3b8;margin-top:4px">${o.description}</p>
          </div>
          ${o.savings > 0 ? `<div style="background:#f59e0b22;border:1px solid #f59e0b44;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:700;color:#f59e0b;white-space:nowrap">Save ${ms2s(o.savings)}</div>` : ''}
        </div>`).join('')}` : ''}`;
    })();

    // ── Security ─────────────────────────────────────────────────────────────
    const secBody = skipped(data.security) ? notTested : (() => {
      const s = data.security!;
      const alerts = s.alerts ?? [];
      const riskColor: Record<string, string> = { High: '#ef4444', Medium: '#f97316', Low: '#f59e0b', Informational: '#3b82f6' };
      const grouped = ['High', 'Medium', 'Low', 'Informational'].map(risk => ({
        risk, items: alerts.filter((a: any) => a.riskLevel === risk || a.risk === risk),
      })).filter(g => g.items.length > 0);
      return `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
          ${(['High', 'Medium', 'Low', 'Informational'] as const).map(risk => {
            const count = alerts.filter((a: any) => (a.riskLevel ?? a.risk) === risk).length;
            return `<div style="background:#1e293b;border-radius:8px;padding:14px;text-align:center;border-top:3px solid ${riskColor[risk]}"><div style="font-size:28px;font-weight:800;color:${count > 0 ? riskColor[risk] : '#22c55e'}">${count}</div><div style="font-size:11px;color:#64748b;margin-top:4px">${risk}</div></div>`;
          }).join('')}
        </div>
        ${alerts.length === 0
          ? '<p style="color:#22c55e;font-size:14px">✓ No security alerts detected.</p>'
          : grouped.map(g => `
        <div style="margin-bottom:16px">
          <h3 style="font-size:13px;font-weight:700;color:${riskColor[g.risk]};margin-bottom:10px;text-transform:uppercase;letter-spacing:.04em">${g.risk} Risk (${g.items.length})</h3>
          ${g.items.map((alert: any) => `
          <div style="border:1px solid #1e293b;border-radius:8px;margin-bottom:8px;overflow:hidden">
            <div style="padding:12px 16px;background:#1e293b;border-left:4px solid ${riskColor[g.risk]};display:flex;align-items:center;justify-content:space-between">
              <strong style="font-size:13px;color:#e2e8f0">${alert.name}</strong>
              <span style="font-size:11px;color:#64748b">Confidence: ${alert.confidence} | Count: ${alert.count}</span>
            </div>
            <div style="padding:14px 16px">
              <p style="font-size:13px;color:#94a3b8;margin-bottom:10px">${alert.description?.slice(0, 300) ?? ''}</p>
              ${alert.solution ? `<div style="background:#0a0f1e;border-left:3px solid #22c55e;padding:10px 14px;border-radius:6px;font-size:12px;color:#86efac;margin-bottom:8px">✅ <strong>Solution:</strong> ${alert.solution?.slice(0, 300) ?? ''}</div>` : ''}
              ${alert.url ? `<p style="font-size:11px;color:#475569;font-family:monospace">URL: ${alert.url}</p>` : ''}
              ${alert.cweid ? `<p style="font-size:11px;color:#475569;margin-top:4px">CWE-${alert.cweid}${alert.wascid ? ` | WASC-${alert.wascid}` : ''}</p>` : ''}
            </div>
          </div>`).join('')}
        </div>`).join('')}`;
    })();

    // ── Code Quality ─────────────────────────────────────────────────────────
    const cqBody = !data.codeQuality ? `<p style="color:#475569;font-size:14px;font-style:italic;padding:12px 0">⚠ Not tested — no repository URL configured for this project. Add a Repository URL in project settings to enable code quality scanning.</p>` : (() => {
      const cq = data.codeQuality!;
      const ratingColor: Record<string, string> = { A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#f97316', E: '#ef4444' };
      return `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
          ${[
            { label: 'Rating', value: cq.rating, color: ratingColor[cq.rating] ?? '#64748b' },
            { label: 'Coverage', value: `${(cq.coverage ?? 0).toFixed(1)}%`, color: (cq.coverage ?? 0) >= 80 ? '#22c55e' : (cq.coverage ?? 0) >= 50 ? '#f59e0b' : '#ef4444' },
            { label: 'Bugs', value: String(cq.bugs ?? 0), color: (cq.bugs ?? 0) === 0 ? '#22c55e' : '#ef4444' },
            { label: 'Vulnerabilities', value: String(cq.vulnerabilities ?? 0), color: (cq.vulnerabilities ?? 0) === 0 ? '#22c55e' : '#ef4444' },
          ].map(m => `<div style="background:#1e293b;border-radius:8px;padding:14px;text-align:center"><div style="font-size:28px;font-weight:800;color:${m.color}">${m.value}</div><div style="font-size:11px;color:#64748b;margin-top:4px">${m.label}</div></div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
          ${[
            { label: 'Duplications', value: `${(cq.duplications ?? 0).toFixed(1)}%`, color: (cq.duplications ?? 0) < 5 ? '#22c55e' : (cq.duplications ?? 0) < 15 ? '#f59e0b' : '#ef4444' },
            { label: 'Code Smells', value: String(cq.codeSmells ?? 0), color: (cq.codeSmells ?? 0) === 0 ? '#22c55e' : (cq.codeSmells ?? 0) < 10 ? '#f59e0b' : '#ef4444' },
            { label: 'Security Hotspots', value: String(cq.securityHotspots ?? 0), color: (cq.securityHotspots ?? 0) === 0 ? '#22c55e' : '#f97316' },
            { label: 'Technical Debt', value: cq.technicalDebt ?? '0min', color: '#94a3b8' },
          ].map(m => `<div style="background:#1e293b;border-radius:8px;padding:14px;text-align:center"><div style="font-size:20px;font-weight:700;color:${m.color}">${m.value}</div><div style="font-size:11px;color:#64748b;margin-top:4px">${m.label}</div></div>`).join('')}
        </div>
        <div style="background:#1e293b;border-radius:8px;padding:14px">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="border-bottom:1px solid #0f172a">
              <th style="text-align:left;padding:6px 10px;color:#64748b;font-weight:600">Metric</th>
              <th style="text-align:left;padding:6px 10px;color:#64748b;font-weight:600">Value</th>
              <th style="text-align:left;padding:6px 10px;color:#64748b;font-weight:600">Status</th>
            </tr></thead>
            <tbody>
              ${[
                { metric: 'Test Coverage', value: `${(cq.coverage ?? 0).toFixed(1)}%`, status: (cq.coverage ?? 0) >= 80 ? '✓ Good' : (cq.coverage ?? 0) >= 50 ? '⚠ Needs improvement' : '✗ Low', statusColor: (cq.coverage ?? 0) >= 80 ? '#22c55e' : (cq.coverage ?? 0) >= 50 ? '#f59e0b' : '#ef4444' },
                { metric: 'Code Duplication', value: `${(cq.duplications ?? 0).toFixed(1)}%`, status: (cq.duplications ?? 0) < 5 ? '✓ Good' : '⚠ High', statusColor: (cq.duplications ?? 0) < 5 ? '#22c55e' : '#f59e0b' },
                { metric: 'Maintainability Rating', value: cq.rating, status: cq.rating === 'A' ? '✓ Excellent' : cq.rating === 'B' ? '✓ Good' : cq.rating === 'C' ? '⚠ Fair' : '✗ Poor', statusColor: ratingColor[cq.rating] ?? '#64748b' },
                { metric: 'Bug Count', value: String(cq.bugs ?? 0), status: (cq.bugs ?? 0) === 0 ? '✓ Clean' : '✗ Has bugs', statusColor: (cq.bugs ?? 0) === 0 ? '#22c55e' : '#ef4444' },
                { metric: 'Security Vulnerabilities', value: String(cq.vulnerabilities ?? 0), status: (cq.vulnerabilities ?? 0) === 0 ? '✓ Secure' : '✗ Vulnerable', statusColor: (cq.vulnerabilities ?? 0) === 0 ? '#22c55e' : '#ef4444' },
              ].map(r => `<tr style="border-bottom:1px solid #0f172a"><td style="padding:8px 10px;color:#e2e8f0">${r.metric}</td><td style="padding:8px 10px;color:#94a3b8;font-weight:600">${r.value}</td><td style="padding:8px 10px;color:${r.statusColor};font-size:12px">${r.status}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    })();

    // ── All Issues ───────────────────────────────────────────────────────────
    const issuesBody = issues.length === 0
      ? '<p style="color:#22c55e;font-size:14px">✓ No issues found across all tests.</p>'
      : (['critical', 'high', 'medium', 'low', 'info'] as const)
          .map(sev2 => {
            const group = issues.filter(i => i.severity === sev2);
            return group.length === 0 ? '' : `
              <div style="margin-bottom:20px">
                <h3 style="font-size:13px;font-weight:700;color:#64748b;margin-bottom:10px;text-transform:uppercase;letter-spacing:.05em">${sev2} (${group.length})</h3>
                ${group.map(issueRow).join('')}
              </div>`;
          }).join('');

    const now = formatDate(new Date());

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QA Report — Run ${runId.slice(0, 8)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#060d1f;color:#e2e8f0;line-height:1.6;font-size:14px}
    a{color:#6366f1;text-decoration:none}
    a:hover{text-decoration:underline}
    @media print{
      .no-print{display:none!important}
      body{background:#fff;color:#000}
      .section-wrapper{break-inside:avoid}
    }
    ::-webkit-scrollbar{width:6px;height:6px}
    ::-webkit-scrollbar-track{background:#0f172a}
    ::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
  </style>
</head>
<body>

<!-- TOP NAV -->
<div class="no-print" style="position:sticky;top:0;z-index:100;background:#0f172a;border-bottom:1px solid #1e293b;padding:10px 24px;display:flex;align-items:center;justify-content:space-between">
  <div style="display:flex;align-items:center;gap:16px">
    <span style="font-weight:700;font-size:15px;color:#e2e8f0">QA Report</span>
    <span style="color:#334155">|</span>
    <span style="font-size:12px;color:#64748b;font-family:monospace">${runId}</span>
  </div>
  <div style="display:flex;gap:8px">
    ${['#summary','#tested','#accessibility','#performance','#security','#code-quality','#issues'].map(id =>
      `<a href="${id}" style="font-size:12px;color:#64748b;padding:4px 8px;border-radius:4px;white-space:nowrap" onmouseover="this.style.color='#e2e8f0'" onmouseout="this.style.color='#64748b'">${id.slice(1).replace('-',' ')}</a>`
    ).join('')}
    <button onclick="window.print()" style="font-size:12px;background:#1e293b;color:#94a3b8;border:1px solid #334155;border-radius:6px;padding:4px 12px;cursor:pointer;margin-left:8px">🖨 Print</button>
  </div>
</div>

<div style="max-width:1140px;margin:0 auto;padding:40px 24px">

  <!-- HEADER -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:40px;padding-bottom:28px;border-bottom:1px solid #1e293b">
    <div>
      <h1 style="font-size:28px;font-weight:800;color:#f8fafc;margin-bottom:6px">QA Automation Report</h1>
      <p style="font-size:13px;color:#475569">Run ID: <span style="font-family:monospace;color:#94a3b8">${runId}</span></p>
      <p style="font-size:13px;color:#475569;margin-top:2px">Generated: ${now}</p>
    </div>
    <div style="text-align:right">
      <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 20px;border-radius:24px;font-size:15px;font-weight:700;${summary.passed ? 'background:#22c55e20;color:#22c55e;border:1px solid #22c55e40' : 'background:#ef444420;color:#ef4444;border:1px solid #ef444440'}">
        ${summary.passed ? '✓ PASSED' : '✗ FAILED'}
      </div>
      <p style="font-size:12px;color:#475569;margin-top:8px">${summary.totalIssues} total issue${summary.totalIssues !== 1 ? 's' : ''} found</p>
    </div>
  </div>

  <!-- SCORES -->
  <div id="summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;margin-bottom:40px">
    ${scoreCard('Overall', summary.overallScore, summary.passed ? '✓ Pass' : '✗ Fail')}
    ${scoreCard('A11y', summary.accessibilityScore)}
    ${scoreCard('Performance', summary.performanceScore)}
    ${scoreCard('Security', summary.securityScore)}
    ${scoreCard('Code Quality', summary.codeQualityScore)}
  </div>

  <!-- ISSUE COUNTS -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:40px">
    ${(['critical','high','medium','low','info'] as const).map(sv => {
      const count = issues.filter(i => i.severity === sv).length;
      const c: Record<string,string> = {critical:'#ef4444',high:'#f97316',medium:'#f59e0b',low:'#3b82f6',info:'#64748b'};
      return `<div style="background:#0f172a;border:1px solid #1e293b;border-top:3px solid ${c[sv]};border-radius:10px;padding:16px;text-align:center">
        <div style="font-size:28px;font-weight:800;color:${count > 0 ? c[sv] : '#22c55e'}">${count}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.05em">${sv}</div>
      </div>`;
    }).join('')}
  </div>

  <!-- WHAT WAS TESTED -->
  <div id="tested" style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:28px;margin-bottom:24px">
    <h2 style="font-size:17px;font-weight:700;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #1e293b">📋 Test Coverage</h2>
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:1px solid #1e293b">
          <th style="text-align:left;padding:10px 14px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Test</th>
          <th style="text-align:center;padding:10px 14px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Ran</th>
          <th style="text-align:center;padding:10px 14px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Score</th>
          <th style="text-align:left;padding:10px 14px;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Result</th>
        </tr>
      </thead>
      <tbody style="divide-y:1px solid #0f172a">
        ${testedRows}
      </tbody>
    </table>
  </div>

  <!-- ACCESSIBILITY -->
  ${section('accessibility', '♿', 'Accessibility', a11yBody, data.accessibility?.score)}

  <!-- PERFORMANCE -->
  ${section('performance', '⚡', 'Performance', perfBody, hasRealPerf ? data.performance?.score : undefined)}

  <!-- SECURITY -->
  ${section('security', '🔒', 'Security Scan', secBody, data.security?.score)}

  <!-- CODE QUALITY -->
  ${section('code-quality', '🧹', 'Code Quality', cqBody, data.codeQuality?.score)}

  <!-- ALL ISSUES -->
  <div id="issues" style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:28px;margin-bottom:24px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #1e293b">
      <h2 style="font-size:17px;font-weight:700">🐛 All Issues (${issues.length})</h2>
    </div>
    ${issuesBody}
  </div>

  <!-- FOOTER -->
  <div style="text-align:center;color:#334155;font-size:12px;padding:32px 0;border-top:1px solid #1e293b">
    <p>Generated by <strong style="color:#6366f1">QA Platform</strong> — Powered by Playwright · axe-core · OWASP ZAP · SonarQube · OpenAI</p>
    <p style="margin-top:6px;font-family:monospace;font-size:11px;color:#1e293b">Run: ${runId} | ${now}</p>
  </div>

</div>
</body>
</html>`;
  }

  private categoryIcon(category: string): string {
    const icons: Record<string, string> = {
      accessibility: '♿', performance: '⚡',
      security: '🔒', code_quality: '🧹', functional: '⚙️', content: '📝',
    };
    return icons[category] ?? '🔍';
  }
}
