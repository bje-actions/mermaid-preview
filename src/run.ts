import { isPermissionDenied, messageOf, type PullRequestClient, statusOf } from './github';
import {
  type BodyOptions,
  type ChangedFile,
  type DesiredComment,
  isMarkdown,
  type Plan,
  plan,
} from './plan';

/** What `run` reports; `failed` is the action's third output value, set by `main.ts`. */
export type Outcome = 'completed' | 'read-only';

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

export interface RunOptions extends BodyOptions {
  /**
   * True on a pull request from a fork, whose default token cannot write
   * review comments: a permission failure then falls back to the job
   * summary instead of failing the run.
   */
  allowReadOnly: boolean;
}

export async function run(
  client: PullRequestClient,
  options: RunOptions,
  report: Reporter,
): Promise<RunResult> {
  const files: ChangedFile[] = [];
  for (const file of await client.listChangedFiles()) {
    if (file.status !== 'removed' && isMarkdown(file.path)) {
      files.push({ ...file, ...(await client.readHeadFile(file.path)) });
    } else {
      files.push(file);
    }
  }
  const existing = await client.listReviewComments();
  const planned = plan(files, existing, options);
  const summary: string[] = [];
  for (const skip of planned.skipped) {
    report.warning(`${skip.path}: skipped, ${skip.reason}`);
    summary.push(`- \`${skip.path}\`: skipped, ${skip.reason}`);
  }

  let comments = 0;
  let current: DesiredComment | undefined;
  try {
    for (const comment of planned.remove) {
      await client.deleteReviewComment(comment.id);
      report.info(`removed comment for ${comment.key}`);
    }
    for (const comment of planned.update) {
      current = comment;
      await client.updateReviewComment(comment.id, comment.body);
      comments += 1;
    }
    for (const comment of planned.create) {
      current = comment;
      await client.createReviewComment(comment);
      report.info(`commented on ${comment.key} lines ${comment.startLine}-${comment.line}`);
      comments += 1;
    }
  } catch (error) {
    if (!options.allowReadOnly || !isPermissionDenied(error)) {
      throw new Error(
        `writing the comment for ${current?.key ?? 'a removed block'}: ${messageOf(error)}` +
          (options.allowReadOnly ? '' : ' (does the job grant pull-requests: write?)'),
        { cause: error },
      );
    }
    report.warning(
      `the token cannot write review comments (${statusOf(error)}: ${messageOf(error)}); ` +
        `${comments} written before that; links are in the job summary`,
    );
    for (const comment of [...planned.update, ...planned.create]) {
      summary.push(
        `- \`${comment.path}\` lines ${comment.startLine}-${comment.line}: [View in mermaid.live](${comment.link})`,
      );
    }
    return { outcome: 'read-only', plan: planned, comments, summary };
  }
  return { outcome: 'completed', plan: planned, comments, summary };
}
