// Publishes the built site as a single orphan commit, so old trip files never pile up in the branch's history.
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export async function deploy({ dir, repoDir, branch = 'gh-pages', remote = 'origin' }) {
  const url = git(repoDir, ['remote', 'get-url', remote]).trim();
  const name = git(repoDir, ['config', 'user.name']).trim();
  const email = git(repoDir, ['config', 'user.email']).trim();
  const tmp = await mkdtemp(join(tmpdir(), 'fieldbook-deploy-'));
  try {
    await cp(dir, tmp, { recursive: true });
    git(tmp, ['init', '-q', '-b', branch]);
    git(tmp, ['add', '-A']);
    git(tmp, ['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', 'Deploy site']);
    git(tmp, ['push', '-q', '--force', url, `${branch}:${branch}`]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
