import * as core from '@actions/core';
import { context } from '@actions/github';
import { createClient, headShaOf } from './github';
import { run } from './run';

async function main(): Promise<void> {
  const token = core.getInput('token', { required: true });
  const number = Number(core.getInput('pr-number') || context.payload.pull_request?.number);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error('no pull request: run on pull_request or pass pr-number');
  }
  const ref = { owner: context.repo.owner, repo: context.repo.repo, number };
  const headSha: string =
    context.payload.pull_request?.number === number
      ? context.payload.pull_request.head.sha
      : await headShaOf(token, ref);
  const client = createClient(token, { ...ref, headSha });
  const result = await run(client, core.getInput('theme') || 'default', core);
  if (result.summary.length > 0) {
    await core.summary.addHeading('Mermaid preview').addRaw(result.summary.join('\n')).write();
  }
  core.setOutput('outcome', result.outcome);
  core.setOutput('comments', String(result.comments));
}

main().catch((error: unknown) => {
  core.setOutput('outcome', 'failed');
  core.setFailed(error instanceof Error ? error.message : String(error));
});
