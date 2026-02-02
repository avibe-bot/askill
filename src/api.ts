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
        'User-Agent': 'spm-cli',
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
    sort?: 'stars' | 'updated' | 'name';
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
      headers: { 'User-Agent': 'spm-cli' },
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
   * Search for skills (uses listSkills with q parameter)
   */
  async search(q: string, limit: number = 10): Promise<SkillListResponse> {
    return this.listSkills({ q, limit });
  }

  /**
   * Check for CLI updates
   */
  async checkCLIVersion(): Promise<CLIVersionInfo> {
    return this.fetch<CLIVersionInfo>('/cli/version');
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
