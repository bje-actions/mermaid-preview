import type { PullRequestClient } from './github';
import { isForbidden } from './github';
import { type ChangedFile, type Plan, plan } from './plan';

export type Outcome = 'completed' | 'read-only' | 'failed';

export interface RunResult {
  outcome: Outcome;
  plan: Plan;
  /** Comments created or updated. */
  comments: number;
  /** Lines for the job summary. */
  summary: string[];
}

export interface Reporter {
  info(message: string): void;
  warning(message: string): void;
}

export async function run(
  client: PullRequestClient,
  theme: string,
  report: Reporter,
): Promise<RunResult> {
  const files: ChangedFile[] = [];
  for (const file of await client.listChangedFiles()) {
    if (file.status !== 'removed' && /\.(md|markdown|mdx)$/i.test(file.path)) {
      files.push({ ...file, content: await client.readHeadFile(file.path) });
    } else {
      files.push(file);
    }
  }
  const existing = await client.listReviewComments();
  const planned = plan(files, existing, theme);
  const summary: string[] = [];
  for (const skip of planned.skipped) {
    report.warning(`${skip.path}: skipped, ${skip.reason}`);
    summary.push(`- \`${skip.path}\`: skipped, ${skip.reason}`);
  }

  let comments = 0;
  try {
    for (const comment of planned.remove) {
      await client.deleteReviewComment(comment.id);
      report.info(`removed comment for ${comment.key}`);
    }
    for (const comment of planned.update) {
      await client.updateReviewComment(comment.id, comment.body);
      comments += 1;
    }
    for (const comment of planned.create) {
      await client.createReviewComment(comment);
      report.info(`commented on ${comment.key} lines ${comment.startLine}-${comment.line}`);
      comments += 1;
    }
  } catch (error) {
    if (!isForbidden(error)) throw error;
    // A fork pull request's token cannot write review comments. The links are
    // still useful, so they go to the job summary and the run stays green.
    report.warning('the token cannot write review comments; links are in the job summary');
    for (const comment of [...planned.update, ...planned.create]) {
      summary.push('', comment.body.replace(/^<!--.*-->\n/, ''));
    }
    return { outcome: 'read-only', plan: planned, comments, summary };
  }
  return { outcome: 'completed', plan: planned, comments, summary };
}
