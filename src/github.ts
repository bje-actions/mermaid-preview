// The Octokit adapter: every GitHub call the action makes, behind the
// interface `run.ts` consumes, so `run.ts` and `plan.ts` are tested against
// a fake and this file is exercised by the smoke job in ci.yml.
import { getOctokit } from '@actions/github';
import type { ChangedFile, DesiredComment, ExistingComment, FileStatus } from './plan';

export type HeadFile = { content: string } | { unreadable: string };

export interface PullRequestClient {
  listChangedFiles(): Promise<ChangedFile[]>;
  readHeadFile(path: string): Promise<HeadFile>;
  listReviewComments(): Promise<ExistingComment[]>;
  createReviewComment(comment: DesiredComment): Promise<void>;
  updateReviewComment(id: number, body: string): Promise<void>;
  /** Resolves on success and when the comment is already gone (404). */
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
    listChangedFiles: () =>
      describe('listing changed files', async () => {
        const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
          ...base,
          pull_number: pr.number,
          per_page: 100,
        });
        return files.map((file) => ({
          path: file.filename,
          status: file.status as FileStatus,
          changes: file.changes,
          patch: file.patch,
        }));
      }),

    readHeadFile: (path) =>
      describe(`reading ${path} at ${pr.headSha}`, async () => {
        const { data } = await octokit.rest.repos.getContent({ ...base, path, ref: pr.headSha });
        if (Array.isArray(data)) return { unreadable: 'the path is a directory' };
        if (data.type !== 'file') return { unreadable: `the path is a ${data.type}, not a file` };
        // Between 1 MB and 100 MB the contents API sends no content at all.
        if (data.encoding !== 'base64')
          return { unreadable: 'the file is too large for the contents API' };
        return { content: Buffer.from(data.content, 'base64').toString('utf8') };
      }),

    listReviewComments: () =>
      describe('listing review comments', async () => {
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
      }),

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
      try {
        await octokit.rest.pulls.deleteReviewComment({ ...base, comment_id: id });
      } catch (error) {
        if (statusOf(error) !== 404) throw error;
      }
    },
  };
}

/** Rethrow with the call named, so a bare Octokit message says what failed. */
async function describe<T>(what: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new Error(`${what}: ${messageOf(error)}`, { cause: error });
  }
}

export function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
    ? error.status
    : undefined;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True for the 403 a token without `pull-requests: write` gets on a write. */
export function isPermissionDenied(error: unknown): boolean {
  return statusOf(error) === 403;
}
