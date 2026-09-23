// The Octokit adapter: every GitHub call the action makes, behind the
// interface `run.ts` consumes, so `run.ts` and `plan.ts` are tested against
// a fake and this file is exercised by the smoke job in ci.yml.
import { getOctokit } from '@actions/github';
import type { ChangedFile, DesiredComment, ExistingComment } from './plan';

export interface PullRequestClient {
  listChangedFiles(): Promise<ChangedFile[]>;
  readHeadFile(path: string): Promise<string | undefined>;
  listReviewComments(): Promise<ExistingComment[]>;
  createReviewComment(comment: DesiredComment): Promise<void>;
  updateReviewComment(id: number, body: string): Promise<void>;
  deleteReviewComment(id: number): Promise<void>;
}

export interface PullRequestRef {
  owner: string;
  repo: string;
  number: number;
  headSha: string;
}

/** The head commit of a pull request, for a run that names one by number. */
export async function headShaOf(
  token: string,
  ref: Omit<PullRequestRef, 'headSha'>,
): Promise<string> {
  const octokit = getOctokit(token);
  const response = await octokit.rest.pulls.get({
    owner: ref.owner,
    repo: ref.repo,
    pull_number: ref.number,
  });
  return response.data.head.sha;
}

export function createClient(token: string, pr: PullRequestRef): PullRequestClient {
  const octokit = getOctokit(token);
  const base = { owner: pr.owner, repo: pr.repo };

  return {
    async listChangedFiles() {
      const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
        ...base,
        pull_number: pr.number,
        per_page: 100,
      });
      return files.map((file) => ({ path: file.filename, status: file.status, patch: file.patch }));
    },

    async readHeadFile(path) {
      const response = await octokit.rest.repos.getContent({ ...base, path, ref: pr.headSha });
      const data = response.data;
      if (Array.isArray(data) || data.type !== 'file') return undefined;
      return Buffer.from(data.content, 'base64').toString('utf8');
    },

    async listReviewComments() {
      const comments = await octokit.paginate(octokit.rest.pulls.listReviewComments, {
        ...base,
        pull_number: pr.number,
        per_page: 100,
      });
      return comments.map((comment) => ({
        id: comment.id,
        path: comment.path,
        body: comment.body,
        line: comment.line ?? null,
        startLine: comment.start_line ?? null,
      }));
    },

    async createReviewComment(comment) {
      const range =
        comment.startLine === comment.line
          ? {}
          : { start_line: comment.startLine, start_side: 'RIGHT' as const };
      await octokit.rest.pulls.createReviewComment({
        ...base,
        pull_number: pr.number,
        commit_id: pr.headSha,
        path: comment.path,
        body: comment.body,
        line: comment.line,
        side: 'RIGHT',
        ...range,
      });
    },

    async updateReviewComment(id, body) {
      await octokit.rest.pulls.updateReviewComment({ ...base, comment_id: id, body });
    },

    async deleteReviewComment(id) {
      await octokit.rest.pulls.deleteReviewComment({ ...base, comment_id: id });
    },
  };
}

/** True for the HTTP status a read-only token (fork pull request) gets on a write. */
export function isForbidden(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 403 || error.status === 404)
  );
}
