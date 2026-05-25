import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Platform org (hosts the super admin account) ──────────────────────────
  const platformOrg = await prisma.organization.upsert({
    where: { slug: 'qaplatform-internal' },
    update: {},
    create: {
      name: 'QA Platform Internal',
      slug: 'qaplatform-internal',
      plan: 'ENTERPRISE',
      planStatus: 'active',
      projectsLimit: -1,
      runsPerMonth: -1,
      storageGb: 500,
      apiAccessEnabled: true,
      ssoEnabled: true,
    },
  });

  // ── Super admin ────────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: 'superadmin@qaplatform.io' },
    update: {},
    create: {
      email: 'superadmin@qaplatform.io',
      name: 'Platform Super Admin',
      passwordHash: await bcrypt.hash('SuperAdmin1234!', 12),
      role: 'SUPER_ADMIN',
      organizationId: platformOrg.id,
    },
  });

  // ── Organization ──────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
      plan: 'PRO',
      planStatus: 'active',
      projectsLimit: 25,
      runsPerMonth: 1000,
      storageGb: 50,
      apiAccessEnabled: true,
      ssoEnabled: false,
    },
  });

  // ── Admin user ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Demo1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      name: 'Demo Admin',
      passwordHash,
      role: 'ADMIN',
      organizationId: org.id,
    },
  });

  // ── Developer user ─────────────────────────────────────────────────────────
  const dev = await prisma.user.upsert({
    where: { email: 'dev@demo.com' },
    update: {},
    create: {
      email: 'dev@demo.com',
      name: 'Demo Developer',
      passwordHash: await bcrypt.hash('Dev1234!', 12),
      role: 'DEVELOPER',
      organizationId: org.id,
    },
  });

  // ── Default notification preferences ──────────────────────────────────────
  const notifDefaults = [
    { channel: 'email', event: 'run_failure', enabled: true },
    { channel: 'email', event: 'security_issue', enabled: true },
    { channel: 'slack', event: 'run_failure', enabled: false },
    { channel: 'slack', event: 'run_success', enabled: false },
  ];
  for (const pref of notifDefaults) {
    await prisma.notificationPreference.upsert({
      where: { organizationId_channel_event: { organizationId: org.id, channel: pref.channel, event: pref.event } },
      update: {},
      create: { organizationId: org.id, ...pref },
    });
  }

  // ── Sample project ─────────────────────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { id: 'seed-project-001' },
    update: {},
    create: {
      id: 'seed-project-001',
      name: 'Sample E-Commerce Landing',
      description: 'Demo project showing the QA platform in action',
      figmaUrl: 'https://www.figma.com/file/DEMO123/Sample-Design',
      figmaFileId: 'DEMO123',
      repositoryUrl: 'https://github.com/demo-org/ecommerce-landing',
      defaultBranch: 'main',
      status: 'active',
      organizationId: org.id,
      createdById: admin.id,
      settings: {
        autoRunOnFigmaUpdate: false,
        autoRunOnPush: false,
        enabledTests: { visual: true, functional: true, accessibility: true, performance: true, security: true, codeQuality: true },
        thresholds: { visualMatchPercent: 90, accessibilityScore: 85, performanceScore: 75, securityScore: 90 },
      },
    },
  });

  // ── Sample completed run ───────────────────────────────────────────────────
  const run = await prisma.testRun.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      status: 'PASSED',
      triggeredBy: 'manual',
      triggeredById: admin.id,
      gitBranch: 'main',
      gitCommitSha: 'abc1234def5678',
      startedAt: new Date(Date.now() - 8 * 60 * 1000),
      completedAt: new Date(),
      durationMs: 8 * 60 * 1000,
      summary: {
        overallScore: 82,
        passed: true,
        visualScore: 95,
        accessibilityScore: 88,
        performanceScore: 76,
        securityScore: 91,
        codeQualityScore: 84,
        totalIssues: 7,
        criticalIssues: 0,
        warnings: 4,
      },
      stages: {
        create: [
          { type: 'figma_ingestion',  status: 'passed', durationMs: 3200,   logs: ['✓ Parsed 3 pages, 12 frames'] },
          { type: 'code_generation',  status: 'passed', durationMs: 45000,  logs: ['✓ Generated 24 components'] },
          { type: 'deployment',       status: 'passed', durationMs: 12000,  logs: ['✓ Preview deployed'] },
          { type: 'visual_regression',status: 'passed', durationMs: 28000,  logs: ['✓ 95.2% match across 12 frames'] },
          { type: 'functional',       status: 'passed', durationMs: 22000,  logs: ['✓ 18/18 test cases passed'] },
          { type: 'accessibility',    status: 'passed', durationMs: 9000,   logs: ['✓ 2 violations found (0 critical)'] },
          { type: 'performance',      status: 'passed', durationMs: 35000,  logs: ['✓ LCP: 1.8s, CLS: 0.04'] },
          { type: 'security',         status: 'passed', durationMs: 120000, logs: ['✓ 1 medium, 2 low findings'] },
          { type: 'code_quality',     status: 'passed', durationMs: 15000,  logs: ['✓ Rating B, 84% coverage'] },
          { type: 'report_generation',status: 'passed', durationMs: 8000,   logs: ['✓ Report generated'] },
        ],
      },
    },
  });

  // ── Sample failed run (for Copilot demo) ──────────────────────────────────
  const failedRun = await prisma.testRun.create({
    data: {
      projectId: project.id,
      organizationId: org.id,
      status: 'FAILED',
      triggeredBy: 'github_push',
      triggeredById: dev.id,
      gitBranch: 'feature/new-checkout',
      gitCommitSha: 'deadbeef001',
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      durationMs: 60 * 60 * 1000,
      summary: { overallScore: 42, passed: false, totalIssues: 14, criticalIssues: 3 },
      stages: {
        create: [
          { type: 'figma_ingestion',  status: 'passed', durationMs: 3100,  logs: ['✓ Parsed OK'] },
          { type: 'code_generation',  status: 'passed', durationMs: 41000, logs: ['✓ Generated OK'] },
          { type: 'deployment',       status: 'passed', durationMs: 11000, logs: ['✓ Deployed'] },
          { type: 'visual_regression',status: 'failed', durationMs: 32000, logs: ['✗ 58% match — below 90% threshold', 'Failed frames: Hero, Checkout, Nav'] },
          { type: 'accessibility',    status: 'failed', durationMs: 8000,  logs: ['✗ 3 critical WCAG 2.1 violations'] },
          { type: 'performance',      status: 'passed', durationMs: 31000, logs: ['✓ LCP: 2.1s'] },
          { type: 'security',         status: 'passed', durationMs: 95000, logs: ['✓ No critical findings'] },
        ],
      },
    },
  });

  // ── Issues for failed run ──────────────────────────────────────────────────
  await prisma.issue.createMany({
    data: [
      {
        runId: failedRun.id,
        category: 'accessibility',
        severity: 'CRITICAL',
        title: 'Form input missing label',
        description: 'The email input on checkout form has no associated label, violating WCAG 1.3.1.',
        location: '/checkout',
        suggestedFix: 'Add <label for="email"> or aria-labelledby attribute.',
        status: 'OPEN',
      },
      {
        runId: failedRun.id,
        category: 'visual',
        severity: 'HIGH',
        title: 'Hero image visual mismatch — 42% similarity',
        description: 'The hero section differs significantly from the Figma design. Font size, spacing, and button colour are off.',
        location: '/landing',
        suggestedFix: 'Check Tailwind classes on HeroSection component against design tokens.',
        status: 'OPEN',
      },
      {
        runId: failedRun.id,
        category: 'accessibility',
        severity: 'CRITICAL',
        title: 'Colour contrast ratio fails WCAG AA',
        description: 'CTA button text (#e2e8f0 on #6366f1) has contrast ratio 2.8:1, below the required 4.5:1.',
        location: '/checkout',
        suggestedFix: 'Use #ffffff text on the brand button colour, achieving 5.1:1 ratio.',
        aiSuggestedFix: 'Change `text-slate-200` to `text-white` on the CTA button class.',
        status: 'OPEN',
      },
    ],
  });

  // ── Issues for passing run ─────────────────────────────────────────────────
  await prisma.issue.createMany({
    data: [
      {
        runId: run.id,
        category: 'accessibility',
        severity: 'MEDIUM',
        title: 'Button missing accessible name',
        description: 'A button element has no label. Screen readers cannot describe its purpose.',
        location: '/checkout',
        suggestedFix: 'Add aria-label or visible text content.',
        aiSuggestedFix: 'Change `<button>→</button>` to `<button aria-label="Next step">→</button>`',
        status: 'OPEN',
      },
      {
        runId: run.id,
        category: 'security',
        severity: 'MEDIUM',
        title: 'Missing Content-Security-Policy header',
        description: 'CSP header absent — app is vulnerable to XSS injection.',
        location: '/',
        suggestedFix: "Set Content-Security-Policy: default-src 'self'",
        status: 'OPEN',
      },
    ],
  });

  // ── QA Report for passing run ──────────────────────────────────────────────
  await prisma.qAReport.upsert({
    where: { runId: run.id },
    update: {},
    create: {
      runId: run.id,
      projectId: project.id,
      organizationId: org.id,
      summary: run.summary as any,
      htmlUrl: 'http://localhost:9000/qa-platform/runs/seed-run/report.html',
      jsonUrl: 'http://localhost:9000/qa-platform/runs/seed-run/report.json',
    },
  });

  // ── Metric snapshots ───────────────────────────────────────────────────────
  const days = 14;
  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400_000);
    await prisma.metricSnapshot.create({
      data: {
        organizationId: org.id,
        projectId: project.id,
        metricName: 'pipeline_duration',
        value: 480 + Math.random() * 120,
        labels: { status: Math.random() > 0.2 ? 'PASSED' : 'FAILED' },
        recordedAt: date,
      },
    });
  }

  // ── Audit log seed entries ─────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { organizationId: org.id, userId: admin.id, action: 'user.login',    resourceType: 'user',    resourceId: admin.id, metadata: { ip: '127.0.0.1' } },
      { organizationId: org.id, userId: admin.id, action: 'project.create',resourceType: 'project', resourceId: project.id, metadata: { name: project.name } },
      { organizationId: org.id, userId: admin.id, action: 'run.trigger',   resourceType: 'run',     resourceId: run.id,    metadata: { trigger: 'manual' } },
    ],
  });

  console.log(`
✅ Seed complete!

┌─────────────────────────────────────────────────┐
│           QA PLATFORM — ACCOUNTS                │
├─────────────────────────────────────────────────┤
│  Super Admin  superadmin@qaplatform.io           │
│               SuperAdmin1234!  (cross-tenant)    │
├─────────────────────────────────────────────────┤
│  Admin        admin@demo.com  /  Demo1234!       │
│  Dev          dev@demo.com    /  Dev1234!        │
├─────────────────────────────────────────────────┤
│  Dashboard  →  http://localhost:3000             │
│  API Docs   →  http://localhost:4000/api/docs    │
│  Admin API  →  http://localhost:4000/api/v1/admin│
│  MinIO      →  http://localhost:9001             │
└─────────────────────────────────────────────────┘
`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
