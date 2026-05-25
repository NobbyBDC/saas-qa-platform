// =============================================================================
// SHARED TYPES - QA Platform
// =============================================================================

// --- Auth & Users ---
export type UserRole = 'admin' | 'developer' | 'qa' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: Date;
}

// --- Projects ---
export type ProjectStatus = 'active' | 'archived' | 'draft';

export interface Project {
  id: string;
  name: string;
  description?: string;
  previewUrl?: string;
  repositoryUrl?: string;
  defaultBranch?: string;
  sonarProjectKey?: string;
  sonarToken?: string;
  status: ProjectStatus;
  organizationId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  settings: ProjectSettings;
  latestRun?: TestRun;
}

export interface ProjectSettings {
  autoRunOnPush: boolean;
  slackWebhookUrl?: string;
  jiraProjectKey?: string;
  enabledTests: EnabledTests;
  thresholds: QAThresholds;
}

export interface EnabledTests {
  functional: boolean;
  accessibility: boolean;
  performance: boolean;
  security: boolean;
  codeQuality: boolean;
}

export interface QAThresholds {
  accessibilityScore: number;       // e.g., 90
  performanceScore: number;         // e.g., 80
  securityScore: number;            // e.g., 90
  codeQualityRating: 'A' | 'B' | 'C' | 'D' | 'E';
}

// --- Test Runs ---
export type RunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TestRun {
  id: string;
  projectId: string;
  status: RunStatus;
  triggeredBy: 'manual' | 'git_push' | 'schedule';
  triggeredById?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  stages: RunStage[];
  summary?: RunSummary;
}

export type StageStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type StageType =
  | 'functional'
  | 'accessibility'
  | 'performance'
  | 'security'
  | 'code_quality'
  | 'report_generation';

export interface RunStage {
  id: string;
  runId: string;
  type: StageType;
  status: StageStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  result?: StageResult;
  logs: string[];
}

export interface RunSummary {
  overallScore: number;             // 0-100 composite
  passed: boolean;
  accessibilityScore?: number;
  performanceScore?: number;
  securityScore?: number;
  codeQualityScore?: number;
  contentAccuracyScore?: number;
  totalIssues: number;
  criticalIssues: number;
  warnings: number;
  reportUrl?: string;
}

// --- Figma ---
export interface FigmaDesignSchema {
  fileId: string;
  fileName: string;
  version: string;
  lastModified: string;
  pages: FigmaPage[];
  designTokens: DesignTokens;
  components: FigmaComponent[];
}

export interface FigmaPage {
  id: string;
  name: string;
  frames: FigmaFrame[];
}

export interface FigmaFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  children: FigmaNode[];
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
}

export interface FigmaNode {
  id: string;
  name: string;
  type: FigmaNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  children?: FigmaNode[];
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  padding?: Spacing;
  margin?: Spacing;
  fills?: Fill[];
  strokes?: Stroke[];
  effects?: Effect[];
  constraints?: Constraints;
  layoutAlign?: string;
  componentId?: string;
  componentSetId?: string;
}

export type FigmaNodeType =
  | 'FRAME'
  | 'GROUP'
  | 'TEXT'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'VECTOR'
  | 'COMPONENT'
  | 'INSTANCE'
  | 'IMAGE'
  | 'BOOLEAN_OPERATION';

export interface FigmaComponent {
  id: string;
  name: string;
  description?: string;
  node: FigmaNode;
  variants?: ComponentVariant[];
}

export interface ComponentVariant {
  id: string;
  name: string;
  properties: Record<string, string>;
}

// --- Design Tokens ---
export interface DesignTokens {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  shadows: ShadowToken[];
  borderRadius: BorderRadiusToken[];
  breakpoints: BreakpointToken[];
}

export interface ColorToken {
  name: string;
  value: string;
  hex: string;
  rgba: { r: number; g: number; b: number; a: number };
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: number;
}

export interface SpacingToken {
  name: string;
  value: number;
  unit: 'px' | 'rem' | 'em';
}

export interface ShadowToken {
  name: string;
  value: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
}

export interface BorderRadiusToken {
  name: string;
  value: number;
}

export interface BreakpointToken {
  name: string;
  value: number;
}

// --- Code Generation ---
export interface GeneratedComponent {
  id: string;
  name: string;
  filePath: string;
  code: string;
  testCode?: string;
  storyCode?: string;
  figmaNodeId: string;
  reusabilityScore: number;         // 0-100
  dependencies: string[];
}

export interface GeneratedProject {
  id: string;
  projectId: string;
  runId: string;
  components: GeneratedComponent[];
  pages: GeneratedPage[];
  designTokenFile: string;
  tailwindConfig: string;
  packageJson: string;
  previewUrl?: string;
  deployedAt?: Date;
}

export interface GeneratedPage {
  id: string;
  name: string;
  route: string;
  filePath: string;
  code: string;
  figmaFrameId: string;
}

// --- Testing Results ---
export interface StageResult {
  type: StageType;
  score?: number;
  issues: Issue[];
  metadata: Record<string, unknown>;
}

export interface AccessibilityResult extends StageResult {
  type: 'accessibility';
  violations: AxeViolation[];
  passes: number;
  incomplete: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: AxeNode[];
  wcagCriteria: string[];
}

export interface AxeNode {
  html: string;
  target: string[];
  failureSummary: string;
}

export interface PerformanceResult extends StageResult {
  type: 'performance';
  url: string;
  metrics: LighthouseMetrics;
  opportunities: LighthouseOpportunity[];
  diagnostics: LighthouseDiagnostic[];
}

export interface LighthouseMetrics {
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  lcp: number;              // ms
  fid: number;              // ms
  cls: number;              // unitless
  tti: number;              // ms
  tbt: number;              // ms
  fcp: number;              // ms
  si: number;               // ms
}

export interface LighthouseOpportunity {
  id: string;
  title: string;
  description: string;
  savings: number;          // ms
}

export interface LighthouseDiagnostic {
  id: string;
  title: string;
  description: string;
  value: string | number;
}

export interface SecurityResult extends StageResult {
  type: 'security';
  alerts: SecurityAlert[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  passedChecks: number;
  failedChecks: number;
}

export interface SecurityAlert {
  id: string;
  pluginId: string;
  alertRef: string;
  name: string;
  riskLevel: 'Informational' | 'Low' | 'Medium' | 'High';
  confidence: 'Low' | 'Medium' | 'High';
  description: string;
  solution: string;
  url: string;
  evidence?: string;
  cweid?: number;
  wascid?: number;
  count: number;
}

export interface CodeQualityResult extends StageResult {
  type: 'code_quality';
  rating: 'A' | 'B' | 'C' | 'D' | 'E';
  coverage: number;
  duplications: number;
  codeSmells: number;
  bugs: number;
  vulnerabilities: number;
  securityHotspots: number;
  technicalDebt: string;  // e.g., "2h 30min"
  measures: SonarMeasure[];
}

export interface SonarMeasure {
  metric: string;
  value: string;
  bestValue?: boolean;
}

// --- Issues ---
export type IssueSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type IssueCategory =
  | 'content'
  | 'accessibility'
  | 'performance'
  | 'security'
  | 'code_quality'
  | 'functional';

export interface Issue {
  id: string;
  runId: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  description: string;
  location?: string;
  screenshotUrl?: string;
  suggestedFix?: string;
  aiSuggestedFix?: string;
  jiraTicketId?: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'wontfix';
  createdAt: Date;
}

// --- Reports ---
export interface QAReport {
  id: string;
  runId: string;
  projectId: string;
  generatedAt: Date;
  summary: RunSummary;
  accessibilityResult?: AccessibilityResult;
  performanceResult?: PerformanceResult;
  securityResult?: SecurityResult;
  codeQualityResult?: CodeQualityResult;
  issues: Issue[];
  pdfUrl?: string;
  htmlUrl?: string;
  jsonUrl?: string;
}

// --- Events (for message queue) ---
export type EventType =
  | 'project.created'
  | 'run.queued'
  | 'run.started'
  | 'stage.started'
  | 'stage.completed'
  | 'stage.failed'
  | 'run.completed'
  | 'run.failed'
  | 'report.generated'
  | 'issue.created';

export interface PlatformEvent<T = unknown> {
  id: string;
  type: EventType;
  projectId: string;
  runId?: string;
  payload: T;
  timestamp: Date;
}

// --- API Responses ---
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

// --- Utility types ---
export interface Spacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Fill {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  color?: { r: number; g: number; b: number; a: number };
  opacity?: number;
}

export interface Stroke {
  type: 'SOLID';
  color: { r: number; g: number; b: number; a: number };
  weight: number;
}

export interface Effect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible: boolean;
  radius?: number;
  color?: { r: number; g: number; b: number; a: number };
  offsetX?: number;
  offsetY?: number;
}

export interface Constraints {
  horizontal: 'LEFT' | 'RIGHT' | 'CENTER' | 'SCALE' | 'STRETCH';
  vertical: 'TOP' | 'BOTTOM' | 'CENTER' | 'SCALE' | 'STRETCH';
}

export interface WebSocketMessage {
  event: string;
  data: unknown;
  runId?: string;
  projectId?: string;
}
