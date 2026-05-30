// API Client for askill.sh

import { API_BASE_URL } from './constants.ts';

/**
 * Skill data returned from API
 * Based on dashboard AgentSkill model
 */
export interface Skill {
  id: number;
  name: string | null;           // skillName
  description: string | null;
  tags: string[];
  stars: number | null;
  aiScore?: number | null;
  aiBreakdown?: Record<string, number> | null;
  llmScore?: number | null;
  llmScoreMeta?: unknown;
  owner: string | null;          // repoOwner
  repo: string | null;           // repoName
  path: string | null;           // filePath without /SKILL.md
  updatedAt: string | null;      // lastPushed as ISO string
  createdAt?: string | null;
  rawContent?: string | null;
}

export interface RepoSkill {
  id: number;
  name: string | null;
  description: string | null;
  tags: string[];
  path: string | null;
  updatedAt: string | null;
}

export interface RepoSkillsResponse {
  owner: string;
  repo: string;
  repoUrl: string;
  count: number;
  skills: RepoSkill[];
}

export interface SkillListResponse {
  data: Skill[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type SkillSort = 'llm_score' | 'popular_score' | 'stars' | 'updated' | 'name';

export interface SearchResult {
  id: number;
  name: string | null;
  description: string | null;
  tags: string[];
  owner: string | null;
  repo: string | null;
}

export interface SearchResponse {
  data: SearchResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Tag {
  name: string;
  count: number;
}

export interface CLIVersionInfo {
  latest: string;
  minimum: string;
  releaseNotes: string;
  downloadUrls: Record<string, string>;
}

export interface SubmitSkillResult {
  name: string | null;
  path: string;
  status: 'indexed' | 'skipped' | 'failed';
}

export interface SubmitResponse {
  repoOwner: string;
  repoName: string;
  message: string;
  skills: SubmitSkillResult[];
}

export interface AuthMeResponse {
  username: string | null;
  name: string | null;
  image: string | null;
}

export interface CollectionSkill {
  id: number;
  skillName: string | null;
  description: string | null;
  repoOwner: string | null;
  repoName: string | null;
  filePath: string | null;
  tags: string[];
  installRef: string;
}

export interface CollectionResponse {
  owner: string;
  handle: string;
  name: string;
  description: string | null;
  count: number;
  installCommand: string;
  url: string;
  skills: CollectionSkill[];
}

export interface PublishResponse {
  id: number;
  slug: string;
  version: string;
  url: string;
  message: string;
}

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'askill-cli',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        error.error?.code || 'UNKNOWN_ERROR',
        error.error?.message || `HTTP ${response.status}`
      );
    }

    return response.json();
  }

  /**
   * List skills with pagination and filtering
   */
  async listSkills(options: {
    page?: number;
    limit?: number;
    q?: string;
    tag?: string;
    owner?: string;
    repo?: string;
    sort?: SkillSort;
    order?: 'asc' | 'desc';
  } = {}): Promise<SkillListResponse> {
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.q) params.set('q', options.q);
    if (options.tag) params.set('tag', options.tag);
    if (options.owner) params.set('owner', options.owner);
    if (options.repo) params.set('repo', options.repo);
    if (options.sort) params.set('sort', options.sort);
    if (options.order) params.set('order', options.order);

    const query = params.toString();
    return this.fetch<SkillListResponse>(`/skills${query ? `?${query}` : ''}`);
  }

  /**
   * Get all skills in a repository
   */
  async getRepoSkills(owner: string, repo: string): Promise<RepoSkillsResponse> {
    return this.fetch<RepoSkillsResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/skills`);
  }

  /**
   * Get a single skill by slug
   * 
   * Supported formats:
   * - ID: "123"
   * - Short name: "extract-errors" 
   * - Owner/repo@name: "facebook/react@extract-errors"
   * - Full path: "facebook/react/scripts/error-codes"
   */
  async getSkill(slug: string): Promise<Skill> {
    return this.fetch<Skill>(`/skills/${encodeURIComponent(slug)}`);
  }

  /**
   * Get the raw SKILL.md content
   */
  async getSkillRaw(slug: string): Promise<string> {
    const url = `${this.baseUrl}/skills/${encodeURIComponent(slug)}/raw`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'askill-cli' },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new APIError(
        response.status,
        error.error?.code || 'NOT_FOUND',
        error.error?.message || 'Skill not found'
      );
    }

    return response.text();
  }

  /**
   * Get a shared skill collection by owner and handle
   */
  async getCollection(owner: string, handle: string): Promise<CollectionResponse> {
    return this.fetch<CollectionResponse>(`/collections/${encodeURIComponent(owner)}/${encodeURIComponent(handle)}`);
  }

  /**
   * Search for skills (uses listSkills with q parameter)
   */
  async search(q: string, options: {
    page?: number;
    limit?: number;
    sort?: SkillSort;
    order?: 'asc' | 'desc';
  } = {}): Promise<SkillListResponse> {
    return this.listSkills({
      q,
      page: options.page,
      limit: options.limit,
      sort: options.sort,
      order: options.order,
    });
  }

  /**
   * Check for CLI updates
   */
  async checkCLIVersion(): Promise<CLIVersionInfo> {
    return this.fetch<CLIVersionInfo>('/cli/version');
  }

  /**
   * Submit GitHub URL for indexing
   */
  async submit(url: string): Promise<SubmitResponse> {
    return this.fetch<SubmitResponse>('/submit', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  /**
   * Verify API token and fetch user profile
   */
  async authMe(token: string): Promise<AuthMeResponse> {
    return this.fetch<AuthMeResponse>('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  /**
   * Publish a skill from local content or GitHub URL
   */
  async publish(payload: { token?: string; content?: string; githubUrl?: string }): Promise<PublishResponse> {
    const headers: Record<string, string> = {};
    if (payload.token) {
      headers.Authorization = `Bearer ${payload.token}`;
    }

    return this.fetch<PublishResponse>('/publish', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: payload.content,
        githubUrl: payload.githubUrl,
      }),
    });
  }
}

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export const api = new APIClient();
export default api;
