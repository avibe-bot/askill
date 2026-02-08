# askill.sh API 规范 v1

## 基础信息

- **Base URL**: `https://askill.sh/api/v1`
- **Content-Type**: `application/json`
- **认证**: 公开 API 无需认证

---

## Skill 唯一标识

每个 Skill 由以下信息组合唯一标识：

- `owner` - GitHub 仓库所有者 (如 "facebook")
- `repo` - 仓库名称 (如 "react")  
- `name` - Skill 名称 (如 "extract-errors")
- `path` - SKILL.md 文件路径 (如 "scripts/error-codes")

**CLI 支持的标识格式:**
- `@author/slug` - 发布技能 canonical slug
- `extract-errors` - 短名称 (需全局唯一)
- `facebook/react` - 列出仓库中所有 skills
- `facebook/react@extract-errors` - 指定 owner/repo 和 skill 名称
- `facebook/react/scripts/error-codes` - 完整路径格式

---

## 端点

### 1. 获取 Skill 列表

```
GET /api/v1/skills
```

**Query Parameters:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page` | number | 否 | 页码，默认 1 |
| `limit` | number | 否 | 每页数量，默认 20，最大 100 |
| `q` | string | 否 | 搜索关键词 |
| `tag` | string | 否 | 按标签筛选 |
| `owner` | string | 否 | 按仓库所有者筛选 |
| `repo` | string | 否 | 按仓库名筛选 |
| `sort` | string | 否 | 排序: `stars`, `updated`, `name` |
| `order` | string | 否 | 排序方向: `asc`, `desc` |

**Response:**

```json
{
  "data": [
    {
      "id": 1778,
      "name": "extract-errors",
      "description": "Use when adding new error messages to React...",
      "tags": ["ci-cd", "linting"],
      "stars": 242600,
      "owner": "facebook",
      "repo": "react",
      "path": "scripts/error-codes",
      "updatedAt": "2026-01-28T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1600,
    "totalPages": 80
  }
}
```

---

### 2. 获取仓库中的所有 Skills

```
GET /api/v1/repos/:owner/:repo/skills
```

**Path Parameters:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `owner` | string | 仓库所有者 |
| `repo` | string | 仓库名称 |

**Response:**

```json
{
  "owner": "facebook",
  "repo": "react",
  "repoUrl": "https://github.com/facebook/react",
  "count": 2,
  "skills": [
    {
      "id": 1778,
      "name": "extract-errors",
      "description": "Use when adding new error messages to React...",
      "tags": ["ci-cd", "linting"],
      "path": "scripts/error-codes",
      "updatedAt": "2026-01-28T00:00:00Z"
    },
    {
      "id": 1779,
      "name": "build-for-release",
      "description": "Build React for production release...",
      "tags": ["build"],
      "path": "scripts/release",
      "updatedAt": "2026-01-27T00:00:00Z"
    }
  ]
}
```

---

### 3. 获取单个 Skill 详情

```
GET /api/v1/skills/:slug
```

**Path Parameters:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `slug` | string | Skill 标识，支持多种格式 |

**支持的 Slug 格式:**
- 数字 ID: `123`
- 发布 slug: `@author/slug` 或 `@author/slug@version`
- 短名称: `extract-errors` (需全局唯一)
- @ 格式: `facebook/react@extract-errors`
- 完整路径: `facebook/react/scripts/error-codes`

**Response:**

```json
{
  "id": 1778,
  "name": "extract-errors",
  "description": "Use when adding new error messages to React, or seeing \"unknown error code\" warnings.",
  "tags": ["ci-cd", "linting"],
  "stars": 242600,
  "owner": "facebook",
  "repo": "react",
  "path": "scripts/error-codes",
  "updatedAt": "2026-01-28T00:00:00Z",
  "createdAt": "2025-10-15T00:00:00Z",
  "rawContent": "---\nname: extract-errors\n..."
}
```

---

### 4. 获取 SKILL.md 原始内容

```
GET /api/v1/skills/:slug/raw
```

**Response:**

```
Content-Type: text/markdown; charset=utf-8

---

### 5. 发布 Skill

```
POST /api/v1/publish
```

**Body（两种方式二选一）:**

```json
{
  "content": "---\nname: my-skill\nslug: my-skill\nversion: 1.0.0\n..."
}
```

```json
{
  "githubUrl": "https://github.com/owner/repo/blob/main/path/to/SKILL.md"
}
```

规则：

- `content`（本地发布）需要 Bearer token，author=登录用户
- `githubUrl`（GitHub 发布）不要求 token，author=repo owner
- `slug` 必填且合法，canonical 结果是 `@author/slug`

典型错误码：`MISSING_SLUG`, `INVALID_VERSION`, `VERSION_EXISTS`, `SLUG_CONFLICT`

---
name: extract-errors
description: Use when adding new error messages to React...
---

# Extract Error Codes

## Instructions

1. Run `yarn extract-errors`
2. Report if any new errors need codes assigned
3. Check if error codes are up to date
```

---

## 错误响应

所有错误返回统一格式：

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Skill not found"
  }
}
```

**常见错误码:**

| HTTP Status | Code | 说明 |
|-------------|------|------|
| 400 | `BAD_REQUEST` | 请求参数错误 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 500 | `INTERNAL_ERROR` | 服务器错误 |

---

## 数据模型

基于 `AgentSkill` 数据库模型：

| 字段 | 类型 | API 字段名 | 说明 |
|------|------|-----------|------|
| `id` | Int | `id` | 主键 |
| `repoOwner` | String | `owner` | GitHub 仓库所有者 |
| `repoName` | String | `repo` | 仓库名称 |
| `filePath` | String | `path` | SKILL.md 路径 (不含 /SKILL.md) |
| `skillName` | String | `name` | Skill 名称 |
| `description` | String | `description` | 描述 |
| `stars` | Int | `stars` | GitHub 星标数 |
| `lastPushed` | DateTime | `updatedAt` | 最后推送时间 |
| `tags` | Json | `tags` | 标签数组 |
| `rawContent` | String | `rawContent` | SKILL.md 原始内容 |
| `createdAt` | DateTime | `createdAt` | 创建时间 |
