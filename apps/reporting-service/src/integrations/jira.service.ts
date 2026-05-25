import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createLogger } from '@qa-platform/shared-utils/logger';

const logger = createLogger('jira-service');

interface CreateIssueInput {
  projectKey: string;
  summary: string;
  description: string;
  priority: string;
  labels: string[];
}

@Injectable()
export class JiraService {
  private readonly host: string;
  private readonly email: string;
  private readonly token: string;

  constructor(private readonly config: ConfigService) {
    this.host = config.get('JIRA_HOST', '');
    this.email = config.get('JIRA_EMAIL', '');
    this.token = config.get('JIRA_API_TOKEN', '');
  }

  async createIssue(input: CreateIssueInput): Promise<string> {
    if (!this.host || !this.token) throw new Error('Jira not configured');

    const { data } = await axios.post(
      `${this.host}/rest/api/3/issue`,
      {
        fields: {
          project: { key: input.projectKey },
          summary: input.summary,
          description: {
            version: 1,
            type: 'doc',
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: input.description }],
            }],
          },
          issuetype: { name: 'Bug' },
          priority: { name: input.priority },
          labels: input.labels,
        },
      },
      {
        auth: { username: this.email, password: this.token },
        headers: { 'Content-Type': 'application/json' },
      },
    );

    logger.info('Created Jira issue', { key: data.key });
    return data.key;
  }
}
