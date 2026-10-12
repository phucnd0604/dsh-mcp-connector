/**
 * Cross-process rotation journal for OAuth grants.
 *
 * DSH JSON storage works as per-process in-memory state plus atomic whole-file replacement,
 * so it does not guarantee write consistency when two DSH Hosts open the same domain. Refresh
 * tokens also usually rotate on every refresh, so Desktop and dsh web running side by side need extra cross-process serialization.
 *
 * One file per grant keeps a stale process from overwriting other grants; files and locks live under
 * $DSH_HOME/storages/mcp_connector_grants_v1, with directory mode 0700 and file mode 0600.
 */
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { grantRecordSchema } from './schema.js';

const JOURNAL_VERSION = 1;
const DEFAULT_LOCK_TIMEOUT_MS = 30_000;
const DEFAULT_STALE_LOCK_MS = 5 * 60_000;

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

function fileId(grantKey) {
  return createHash('sha256').update(grantKey).digest('hex');
}

export function defaultGrantJournalDir() {
  if (process.env.NODE_TEST_CONTEXT) return null;
  const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
  return resolve(dshHome, 'storages', 'mcp_connector_grants_v1');
}

async function writeAtomic(path, document) {
  const temp = join(dirname(path), `.${randomUUID()}.tmp`);
  try {
    const handle = await open(temp, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(document, null, 2)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, path);
    await chmod(path, 0o600);
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {});
    throw error;
  }
}

function parseDocument(text, path) {
  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`OAuth grant journal is malformed: ${path}`, { cause: error });
  }
  if (document?.version !== JOURNAL_VERSION) {
    throw new Error(`OAuth grant journal version is unsupported: ${path}`);
  }
  const parsed = grantRecordSchema.safeParse(document.grant);
  if (!parsed.success) {
    throw new Error(`OAuth grant journal record is invalid: ${path}`);
  }
  return parsed.data;
}

export class GrantJournal {
  constructor({ rootDir = defaultGrantJournalDir(), logger } = {}) {
    this.rootDir = rootDir ? resolve(rootDir) : null;
    this.logger = logger;
  }

  get enabled() {
    return this.rootDir !== null;
  }

  async ensureRoot() {
    if (!this.rootDir) return;
    await mkdir(this.rootDir, { recursive: true, mode: 0o700 });
    await chmod(this.rootDir, 0o700);
  }

  recordPath(grantKey) {
    return join(this.rootDir, `${fileId(grantKey)}.json`);
  }

  lockPath(grantKey) {
    return join(this.rootDir, `${fileId(grantKey)}.lock`);
  }

  async get(grantKey) {
    if (!this.rootDir) return undefined;
    try {
      return parseDocument(await readFile(this.recordPath(grantKey), 'utf8'), this.recordPath(grantKey));
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined;
      this.logger?.warn?.(`skip unreadable OAuth grant journal record ${fileId(grantKey)}: ${error.message}`);
      return undefined;
    }
  }

  async entries() {
    if (!this.rootDir) return [];
    await this.ensureRoot();
    const names = await readdir(this.rootDir).catch((error) => {
      if (error?.code === 'ENOENT') return [];
      throw error;
    });
    const out = [];
    for (const name of names.filter((item) => item.endsWith('.json'))) {
      const path = join(this.rootDir, name);
      try {
        const grant = parseDocument(await readFile(path, 'utf8'), path);
        out.push([grant.key, grant]);
      } catch (error) {
        this.logger?.warn?.(`skip unreadable OAuth grant journal record ${name}: ${error.message}`);
      }
    }
    return out;
  }

  async put(grant) {
    if (!this.rootDir) return grant;
    await this.ensureRoot();
    const parsed = grantRecordSchema.parse(grant);
    await writeAtomic(this.recordPath(parsed.key), { version: JOURNAL_VERSION, grant: parsed });
    return parsed;
  }

  async delete(grantKey) {
    if (!this.rootDir) return false;
    try {
      await rm(this.recordPath(grantKey));
      return true;
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
  }

  async withLock(grantKey, task, {
    timeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
    staleLockMs = DEFAULT_STALE_LOCK_MS,
  } = {}) {
    if (!this.rootDir) return task();
    await this.ensureRoot();
    const path = this.lockPath(grantKey);
    const startedAt = Date.now();
    const owner = randomUUID();
    let handle;
    for (;;) {
      try {
        handle = await open(path, 'wx', 0o600);
        try {
          await handle.writeFile(JSON.stringify({ owner, pid: process.pid, createdAt: Date.now() }), 'utf8');
          await handle.sync();
        } catch (error) {
          await handle.close().catch(() => {});
          await rm(path, { force: true }).catch(() => {});
          throw error;
        }
        break;
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        const lockStat = await stat(path).catch(() => null);
        if (lockStat && Date.now() - lockStat.mtimeMs > staleLockMs) {
          await rm(path, { force: true });
          continue;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          const timeout = new Error('timed out waiting for another DSH process to finish OAuth refresh');
          timeout.code = 'refresh_lock_timeout';
          throw timeout;
        }
        await sleep(100);
      }
    }
    try {
      return await task();
    } finally {
      await handle?.close().catch(() => {});
      // Avoid the old owner deleting a lock already taken over by a new process under extreme timeouts (ABA).
      const current = await readFile(path, 'utf8').catch(() => '');
      if (current.includes(`"owner":"${owner}"`)) {
        await rm(path, { force: true }).catch(() => {});
      }
    }
  }
}
