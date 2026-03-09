export interface CollectionSkillLike {
  installRef: string;
  repoOwner?: string | null;
  repoName?: string | null;
  filePath?: string | null;
  skillName?: string | null;
}

export function getCollectionInstallRefs(item: CollectionSkillLike): string[] {
  const primaryRef = item.installRef?.trim();
  if (!primaryRef) return [];

  const refs = [primaryRef];
  const fallbackRef = buildCollectionFallbackRef(item);
  if (fallbackRef && fallbackRef !== primaryRef) {
    refs.push(fallbackRef);
  }

  return refs;
}

export function buildCollectionFallbackRef(item: CollectionSkillLike): string | undefined {
  const owner = item.repoOwner?.trim();
  const repo = item.repoName?.trim();
  if (!owner || !repo) return undefined;

  const subpath = toSkillSubpath(item.filePath);
  if (subpath) {
    return `gh:${owner}/${repo}/${subpath}`;
  }

  const skillName = item.skillName?.trim();
  if (skillName) {
    return `gh:${owner}/${repo}@${skillName}`;
  }

  return `gh:${owner}/${repo}`;
}

function toSkillSubpath(filePath?: string | null): string | undefined {
  if (!filePath) return undefined;

  const normalized = filePath
    .trim()
    .replace(/\\+/g, '/')
    .replace(/^\/+/, '');

  if (!normalized) return undefined;

  const withoutSkillFile = normalized.replace(/\/?SKILL\.md$/i, '').replace(/\/+$/, '');
  return withoutSkillFile || undefined;
}
