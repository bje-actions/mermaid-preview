import * as core from '@actions/core';
import { context } from '@actions/github';
import { createClient, headShaOf, messageOf } from './github';
import { COMMENT_TYPES, type CommentType } from './plan';
import { run } from './run';

async function main(): Promise<void> {
  const token = core.getInput('token', { required: true });
  const input = core.getInput('pr-number');
  const event = context.payload.pull_request;
  const number = input === '' ? event?.number : Number(input);
  if (number === undefined) {
    throw new Error('no pull request: run on a pull_request event or pass pr-number');
  }
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`pr-number must be a positive integer, got '${input}'`);
  }
  const ref = { owner: context.repo.owner, repo: context.repo.repo, number };
  const headSha: string = event?.number === number ? event.head.sha : await headShaOf(token, ref);
  const headRepo: string | undefined = event?.head?.repo?.full_name;
  const type = core.getInput('type') || 'link';
  if (!(COMMENT_TYPES as readonly string[]).includes(type)) {
    throw new Error(`type must be one of ${COMMENT_TYPES.join(', ')}, got '${type}'`);
  }
  const client = createClient(token, { ...ref, headSha });
  const result = await run(
    client,
    {
      theme: core.getInput('theme') || 'default',
      type: type as CommentType,
      attribution: core.getBooleanInput('attribution'),
      allowReadOnly: headRepo !== undefined && headRepo !== `${ref.owner}/${ref.repo}`,
    },
    core,
  );
  if (result.summary.length > 0) {
    await core.summary.addHeading('Mermaid preview').addRaw(result.summary.join('\n')).write();
  }
  core.setOutput('outcome', result.outcome);
  core.setOutput('comments', String(result.comments));
}

main().catch((error: unknown) => {
  core.setOutput('outcome', 'failed');
  core.setOutput('comments', '0');
  if (error instanceof Error && error.stack !== undefined) core.debug(error.stack);
  core.setFailed(messageOf(error));
});
