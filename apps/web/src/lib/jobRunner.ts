import { updateJobStatus } from './jobStorage';
import type { JobRecord } from '../types/job';

type RunnerOptions = {
  onJobsUpdated: (jobs: JobRecord[]) => void;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function runScaffoldJob(jobId: string, options: RunnerOptions): Promise<void> {
  const running = updateJobStatus(jobId, 'running', 'Scaffold runner started (crawler integration pending).');
  options.onJobsUpdated(running);

  await sleep(1200);

  const completed = updateJobStatus(jobId, 'completed', 'Scaffold run completed. Next stage: real crawler pipeline.');
  options.onJobsUpdated(completed);
}
