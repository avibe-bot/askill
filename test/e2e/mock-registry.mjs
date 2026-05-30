import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

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
      createdAt: '2026-03-01T00:00:00.000Z',
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
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    raw: `---
name: beta-collection-skill
description: Beta skill from shared collection
version: 1.0.0
---

# Beta Collection Skill
`,
  },
  '@mock/alpha-major': {
    meta: {
      id: 104,
      name: 'alpha-collection-skill',
      description: 'Alpha skill next major release',
      tags: ['collection', 'alpha'],
      stars: 7,
      owner: 'mock',
      repo: 'skills',
      path: 'alpha',
      updatedAt: '2026-03-09T00:00:00.000Z',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    raw: `---
name: alpha-collection-skill
description: Alpha skill next major release
version: 2.0.0
---

# Alpha Collection Skill 2
`,
  },
  '@mock/alpha@^1.0.0': {
    meta: {
      id: 106,
      name: 'alpha-collection-skill',
      description: 'Alpha skill latest 1.x release',
      tags: ['collection', 'alpha'],
      stars: 8,
      owner: 'mock',
      repo: 'skills',
      path: 'alpha',
      updatedAt: '2026-03-09T12:00:00.000Z',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    raw: `---
name: alpha-collection-skill
description: Alpha skill latest 1.x release
version: 1.1.0
---

# Alpha Collection Skill 1.1
`,
  },
  '@mock/renamed': {
    meta: {
      id: 105,
      name: 'alpha-collection-skill',
      description: 'Alpha skill with renamed remote frontmatter',
      tags: ['collection', 'alpha'],
      stars: 9,
      owner: 'mock',
      repo: 'skills',
      path: 'alpha',
      updatedAt: '2026-03-10T00:00:00.000Z',
      createdAt: '2026-03-01T00:00:00.000Z',
    },
    raw: `---
name: renamed-remote-skill
description: Alpha skill with renamed remote frontmatter
version: 1.1.0
---

# Renamed Remote Skill
`,
  },
};

const skillCatalog = Object.values(skills).map((skill) => skill.meta);

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function normalizeSkillSlug(slug) {
  if (skills[slug]) return slug;
  const match = slug.match(/^(@[^/]+\/[^@/]+)(?:@[^/]+)?$/);
  return match ? match[1] : slug;
}

function skillVersionOverridePath(slug) {
  const key = slug.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `/tmp/askill-mock-${key}-version`;
}

function rawForSkill(slug, raw) {
  try {
    const version = readFileSync(skillVersionOverridePath(slug), 'utf8').trim();
    if (version) {
      return raw.replace(/^version:\s*.+$/m, `version: ${version}`);
    }
  } catch {
    // No override for this test.
  }

  return raw;
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
        { id: 103, skillName: null, description: 'This entry intentionally fails to resolve', repoOwner: 'mock', repoName: 'skills', filePath: 'broken/SKILL.md', tags: ['collection'], installRef: '@mock/missing' },
      ],
    });
    return;
  }

  if (path === '/api/v1/skills') {
    const query = (url.searchParams.get('q') || '').trim().toLowerCase();
    const tag = (url.searchParams.get('tag') || '').trim().toLowerCase();
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20);

    const filtered = skillCatalog
      .filter((skill) => {
        if (!query) return true;
          const haystack = [
            skill.name,
            skill.description,
            skill.owner,
            skill.repo,
            ...(Array.isArray(skill.tags) ? skill.tags : []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(query);
      })
      .filter((skill) => {
        if (!tag) return true;
        return Array.isArray(skill.tags) && skill.tags.some((value) => String(value).toLowerCase() === tag);
      });

    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    json(res, 200, {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
    return;
  }

  const skillMatch = path.match(/^\/api\/v1\/skills\/(.+)$/);
  if (skillMatch && !path.endsWith('/raw')) {
    const slug = normalizeSkillSlug(decodeURIComponent(skillMatch[1]));
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
    const slug = normalizeSkillSlug(decodeURIComponent(rawMatch[1]));
    const skill = skills[slug];
    if (!skill) {
      json(res, 404, { error: { code: 'NOT_FOUND', message: 'Skill not found' } });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(rawForSkill(slug, skill.raw));
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
