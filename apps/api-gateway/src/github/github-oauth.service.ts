import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class GitHubOAuthService {
  private readonly logger = new Logger(GitHubOAuthService.name);

  constructor(private readonly config: ConfigService) {}

  getAuthorizationUrl(state: string): string {
    const clientId = this.config.getOrThrow('GITHUB_CLIENT_ID');
    const redirectUri = this.config.getOrThrow('GITHUB_REDIRECT_URI');
    const scope = 'repo,read:user,read:org,write:repo_hook';
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; login: string; avatarUrl: string }> {
    const clientId = this.config.getOrThrow('GITHUB_CLIENT_ID');
    const clientSecret = this.config.getOrThrow('GITHUB_CLIENT_SECRET');

    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: clientId, client_secret: clientSecret, code },
      { headers: { Accept: 'application/json' } },
    );

    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) throw new UnauthorizedException('Failed to exchange GitHub code');

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      accessToken,
      login: userRes.data.login,
      avatarUrl: userRes.data.avatar_url,
    };
  }

  async listRepos(accessToken: string): Promise<Array<{ id: number; fullName: string; private: boolean; defaultBranch: string }>> {
    const res = await axios.get('https://api.github.com/user/repos', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 100, sort: 'updated' },
    });
    return res.data.map((r: any) => ({
      id: r.id,
      fullName: r.full_name,
      private: r.private,
      defaultBranch: r.default_branch,
    }));
  }

  async createRepoWebhook(
    accessToken: string,
    repoFullName: string,
    webhookUrl: string,
    secret: string,
  ): Promise<number> {
    const [owner, repo] = repoFullName.split('/');
    const res = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        name: 'web',
        active: true,
        events: ['push', 'pull_request'],
        config: { url: webhookUrl, content_type: 'json', secret },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return res.data.id;
  }

  async postPrComment(accessToken: string, repoFullName: string, prNumber: number, body: string) {
    const [owner, repo] = repoFullName.split('/');
    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  async createPullRequest(
    accessToken: string,
    repoFullName: string,
    opts: { title: string; body: string; head: string; base: string },
  ): Promise<string> {
    const [owner, repo] = repoFullName.split('/');
    const res = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      opts,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return res.data.html_url as string;
  }

  async createBranch(accessToken: string, repoFullName: string, newBranch: string, fromSha: string) {
    const [owner, repo] = repoFullName.split('/');
    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/git/refs`,
      { ref: `refs/heads/${newBranch}`, sha: fromSha },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  async getLatestCommitSha(accessToken: string, repoFullName: string, branch: string): Promise<string> {
    const [owner, repo] = repoFullName.split('/');
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return res.data.object.sha as string;
  }

  verifyWebhookSignature(payload: Buffer, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
