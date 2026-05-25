import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { CodeQualityResult, Issue } from '@qa-platform/shared-types';
import { createLogger } from '@qa-platform/shared-utils/logger';
import { v4 as uuid } from 'uuid';

const logger = createLogger('code-quality');

export interface CodeQualityInput {
  runId: string;
  repositoryUrl?: string;
  defaultBranch?: string;
  sonarProjectKey?: string;
  sonarToken?: string;
}

@Injectable()
export class CodeQualityService {
  private readonly sonarUrl: string;
  private readonly sonarToken: string;

  constructor(private readonly config: ConfigService) {
    this.sonarUrl = config.get('SONAR_URL', '');
    this.sonarToken = config.get('SONAR_TOKEN', '');
  }

  async runAnalysis(input: CodeQualityInput): Promise<CodeQualityResult> {
    const { runId, repositoryUrl, sonarProjectKey, sonarToken: projectSonarToken } = input;
    logger.info('Starting code quality analysis', { runId, repositoryUrl, sonarProjectKey });

    if (!repositoryUrl) {
      logger.warn('No repositoryUrl — skipping code quality', { runId });
      return this.baselineResult(runId);
    }

    // Prefer per-project token; fall back to server-level token
    const effectiveSonarToken = projectSonarToken || this.sonarToken;

    if (this.sonarUrl && effectiveSonarToken && sonarProjectKey) {
      try {
        return await this.runSonarAnalysis(runId, sonarProjectKey, effectiveSonarToken);
      } catch (error: any) {
        logger.warn('SonarQube analysis failed, falling back to heuristic', { error: error.message });
      }
    }

    return this.runHeuristicAnalysis(runId, repositoryUrl);
  }

  private async runSonarAnalysis(runId: string, sonarProjectKey: string, sonarToken: string): Promise<CodeQualityResult> {
    const projectKey = sonarProjectKey;
    const headers = { Authorization: `Basic ${Buffer.from(`${sonarToken}:`).toString('base64')}` };

    const { data } = await axios.get(`${this.sonarUrl}/api/measures/component`, {
      headers,
      params: {
        component: sonarProjectKey,
        metricKeys: 'coverage,duplicated_lines_density,code_smells,bugs,vulnerabilities,security_hotspots,sqale_rating,reliability_rating,security_rating,ncloc',
      },
      timeout: 15000,
    });

    const measure = (key: string) =>
      parseFloat(data.component?.measures?.find((m: any) => m.metric === key)?.value ?? '0');

    const toGrade = (r: number): 'A'|'B'|'C'|'D'|'E' =>
      (['A', 'B', 'C', 'D', 'E'] as const)[Math.min(Math.round(r) - 1, 4)] ?? 'C';

    // Use the worst rating across maintainability, reliability, and security
    const worstRating = Math.max(measure('sqale_rating'), measure('reliability_rating'), measure('security_rating'));
    const rating = toGrade(worstRating);

    const coverage = measure('coverage');
    const duplications = measure('duplicated_lines_density');
    const codeSmells = measure('code_smells');
    const bugs = measure('bugs');
    const vulnerabilities = measure('vulnerabilities');

    return this.buildResult(runId, { rating, coverage, duplications, codeSmells, bugs, vulnerabilities, securityHotspots: measure('security_hotspots') });
  }

  private async runHeuristicAnalysis(runId: string, repositoryUrl: string): Promise<CodeQualityResult> {
    // Heuristic: fetch the repo page and derive basic signals from metadata
    const issues: Issue[] = [];
    let score = 80;

    try {
      const { data } = await axios.get(repositoryUrl, { timeout: 10000, validateStatus: () => true });
      const body = String(data);

      // Penalise for obvious signals in the repo page
      if (/TODO|FIXME|HACK|XXX/i.test(body)) {
        score -= 5;
        issues.push(this.makeIssue(runId, 'Code contains TODO/FIXME markers', 'low'));
      }
      if (/console\.log/i.test(body)) {
        score -= 3;
        issues.push(this.makeIssue(runId, 'console.log statements found in production code', 'low'));
      }
    } catch {
      // Could not reach repo — return baseline
    }

    return this.buildResult(runId, {
      rating: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'E',
      coverage: 0,
      duplications: 0,
      codeSmells: issues.length,
      bugs: 0,
      vulnerabilities: 0,
      securityHotspots: 0,
    }, issues);
  }

  private buildResult(
    runId: string,
    metrics: { rating: 'A'|'B'|'C'|'D'|'E'; coverage: number; duplications: number; codeSmells: number; bugs: number; vulnerabilities: number; securityHotspots: number },
    extraIssues: Issue[] = [],
  ): CodeQualityResult {
    // Score derived from rating band — no multipliers that collapse to 0 on real repos
    const score = { A: 90, B: 75, C: 60, D: 40, E: 20 }[metrics.rating];

    const issues: Issue[] = [...extraIssues];
    if (metrics.bugs > 0)
      issues.push(this.makeIssue(runId, `${metrics.bugs} bug(s) detected`, 'high'));
    if (metrics.vulnerabilities > 0)
      issues.push(this.makeIssue(runId, `${metrics.vulnerabilities} vulnerability(ies) detected`, 'high'));
    if (metrics.coverage < 50)
      issues.push(this.makeIssue(runId, `Low test coverage: ${metrics.coverage.toFixed(1)}%`, 'medium'));
    if (metrics.duplications > 10)
      issues.push(this.makeIssue(runId, `High code duplication: ${metrics.duplications.toFixed(1)}%`, 'medium'));

    return {
      type: 'code_quality',
      score,
      issues,
      metadata: { ...metrics },
      rating: metrics.rating,
      coverage: metrics.coverage,
      duplications: metrics.duplications,
      codeSmells: metrics.codeSmells,
      bugs: metrics.bugs,
      vulnerabilities: metrics.vulnerabilities,
      securityHotspots: metrics.securityHotspots,
      technicalDebt: `${metrics.codeSmells * 30}min`,
      measures: [],
    };
  }

  private baselineResult(runId: string): CodeQualityResult {
    return this.buildResult(runId, {
      rating: 'B', coverage: 0, duplications: 0,
      codeSmells: 0, bugs: 0, vulnerabilities: 0, securityHotspots: 0,
    });
  }

  private makeIssue(runId: string, title: string, severity: Issue['severity']): Issue {
    return {
      id: uuid(), runId, category: 'code_quality', severity,
      title: `Code Quality: ${title}`, description: title,
      status: 'open', createdAt: new Date(),
    };
  }
}
