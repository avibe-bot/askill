import { createServer } from 'node:http';

const port = Number(process.env.MOCK_REGISTRY_PORT || 4010);

const skills = {
  '@mock/alpha': {
    meta: {
      id: 101,
      name: 'alpha-collection-skill',
      description: 'Alpha skill from shared collection',
      tags: ['collection', 'alpha'],
      stars: 3,
      owner: 'mock',
      repo: 'skills',
      path: 'alpha',
      updatedAt: '2026-03-08T00:00:00.000Z',
    },
    raw: `---
name: alpha-collection-skill
description: Alpha skill from shared collection
version: 1.0.0
---

# Alpha Collection Skill
`,
  },
  '@mock/beta': {
    meta: {
      id: 102,
      name: 'beta-collection-skill',
      description: 'Beta skill from shared collection',
      tags: ['collection', 'beta'],
      stars: 5,
      owner: 'mock',
      repo: 'skills',
      path: 'beta',
      updatedAt: '2026-03-08T00:00:00.000Z',
    },
    raw: `---
name: beta-collection-skill
description: Beta skill from shared collection
version: 1.0.0
---

# Beta Collection Skill
`,
  },
};

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const path = decodeURIComponent(url.pathname);

  if (path === '/health') {
    json(res, 200, { ok: true });
    return;
  }

  if (path === '/api/v1/collections/mock/dev-tools--grp123') {
    json(res, 200, {
      owner: 'mock',
      handle: 'dev-tools--grp123',
      name: 'Dev Tools',
      description: 'Mock shared collection for e2e tests',
      isPublic: true,
      count: 3,
      installCommand: 'askill add col:mock/dev-tools--grp123 -y',
      url: '/c/mock/dev-tools--grp123',
      skills: [
        { id: 101, skillName: 'alpha-collection-skill', description: 'Alpha skill from shared collection', repoOwner: 'mock', repoName: 'skills', filePath: 'alpha/SKILL.md', tags: ['collection', 'alpha'], installRef: '@mock/alpha' },
        { id: 102, skillName: 'beta-collection-skill', description: 'Beta skill from shared collection', repoOwner: 'mock', repoName: 'skills', filePath: 'beta/SKILL.md', tags: ['collection', 'beta'], installRef: '@mock/beta' },
        { id: 103, skillName: 'broken-entry', description: 'This entry intentionally fails to resolve', repoOwner: 'mock', repoName: 'skills', filePath: 'broken/SKILL.md', tags: ['collection'], installRef: '@mock/missing' },
      ],
    });
    return;
  }

  const skillMatch = path.match(/^\/api\/v1\/skills\/(.+)$/);
  if (skillMatch && !path.endsWith('/raw')) {
    const slug = decodeURIComponent(skillMatch[1]);
    const skill = skills[slug];
    if (!skill) {
      json(res, 404, { error: { code: 'NOT_FOUND', message: 'Skill not found' } });
      return;
    }
    json(res, 200, skill.meta);
    return;
  }

  const rawMatch = path.match(/^\/api\/v1\/skills\/(.+)\/raw$/);
  if (rawMatch) {
    const slug = decodeURIComponent(rawMatch[1]);
    const skill = skills[slug];
    if (!skill) {
      json(res, 404, { error: { code: 'NOT_FOUND', message: 'Skill not found' } });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(skill.raw);
    return;
  }

  if (path === '/api/v1/cli/version') {
    json(res, 200, {
      latest: '0.1.9',
      minimum: '0.1.0',
      releaseNotes: 'mock',
      downloadUrls: {},
    });
    return;
  }

  json(res, 404, { error: { code: 'NOT_FOUND', message: `Unhandled path: ${path}` } });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`mock-registry:${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
