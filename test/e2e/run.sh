#!/usr/bin/env bash
# askill CLI - E2E Integration Tests
# Run all tests:        ./test/e2e/run.sh
# Run specific test:    ./test/e2e/run.sh test_help
# List available tests: ./test/e2e/run.sh --list

set -euo pipefail

# ── Colors ──────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Counters ────────────────────────────────────────
PASSED=0
FAILED=0
SKIPPED=0
ERRORS=()

# ── CLI path ────────────────────────────────────────
CLI="node /app/dist/cli.mjs"
WORKSPACE="/workspace"
PROJECT_LOCK="$WORKSPACE/.agents/.skill-lock.json"
GLOBAL_LOCK="/root/.agents/.skill-lock.json"
MOCK_REGISTRY_PORT="4010"
MOCK_REGISTRY_PID=""

# Read version from /app/package.json so tests don't hardcode it
cli_version() {
  node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync('/app/package.json','utf8')).version)"
}

# ── Helpers ─────────────────────────────────────────
info()  { echo -e "${DIM}  ℹ $*${RESET}"; }
pass()  { echo -e "${GREEN}  ✓ $*${RESET}"; ((PASSED++)) || true; }
fail()  { echo -e "${RED}  ✗ $*${RESET}"; ((FAILED++)) || true; ERRORS+=("$*"); }
skip()  { echo -e "${YELLOW}  ⊘ $* (skipped)${RESET}"; ((SKIPPED++)) || true; }
header(){ echo -e "\n${BOLD}━━━ $* ━━━${RESET}"; }

# Strip ANSI escape codes from a string
strip_ansi() {
  sed 's/\x1b\[[0-9;]*m//g' | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'
}

# Check if cleaned output matches pattern (for inline use)
output_matches() {
  local output="$1" pattern="$2"
  echo "$output" | strip_ansi | grep -qi "$pattern"
}

# Assert output contains a string (ANSI-stripped)
assert_contains() {
  local output="$1" expected="$2" msg="${3:-}"
  local clean
  clean=$(echo "$output" | strip_ansi)
  if echo "$clean" | grep -qiF -- "$expected"; then
    pass "${msg:-contains '$expected'}"
  else
    fail "${msg:-expected '$expected' in output}"
    echo -e "${DIM}    actual output (first 5 lines):${RESET}"
    echo "$clean" | head -5 | sed 's/^/    /'
  fi
}

# Assert output does NOT contain a string (ANSI-stripped)
assert_not_contains() {
  local output="$1" unexpected="$2" msg="${3:-}"
  local clean
  clean=$(echo "$output" | strip_ansi)
  if echo "$clean" | grep -qiF -- "$unexpected"; then
    fail "${msg:-unexpected '$unexpected' found in output}"
  else
    pass "${msg:-does not contain '$unexpected'}"
  fi
}

# Assert command exits with specific code
assert_exit_code() {
  local expected="$1"; shift
  local actual=0
  "$@" >/dev/null 2>&1 || actual=$?
  if [ "$actual" -eq "$expected" ]; then
    pass "exit code $expected"
  else
    fail "expected exit code $expected, got $actual: $*"
  fi
}

# Clean workspace between tests
clean_workspace() {
  rm -rf "$WORKSPACE"/.claude "$WORKSPACE"/.cursor "$WORKSPACE"/.opencode
  rm -rf "$WORKSPACE"/.agents
  rm -rf /root/.claude/skills /root/.cursor/skills /root/.opencode/skills
  rm -rf /root/.agents
  rm -rf /root/.config/askill
  rm -rf /root/.askill
  rm -f /tmp/askill-mock-*-version
  mkdir -p "$WORKSPACE"
}

stop_mock_registry() {
  if [ -n "${MOCK_REGISTRY_PID:-}" ] && kill -0 "$MOCK_REGISTRY_PID" 2>/dev/null; then
    kill "$MOCK_REGISTRY_PID" 2>/dev/null || true
    wait "$MOCK_REGISTRY_PID" 2>/dev/null || true
  fi
  MOCK_REGISTRY_PID=""
}

start_mock_registry() {
  stop_mock_registry

  MOCK_REGISTRY_PORT="4010"
  MOCK_REGISTRY_PORT="$MOCK_REGISTRY_PORT" node /app/test/e2e/mock-registry.mjs >/tmp/askill-mock-registry.log 2>&1 &
  MOCK_REGISTRY_PID=$!

  local ready=0
  for _ in $(seq 1 30); do
    if node -e "fetch('http://127.0.0.1:${MOCK_REGISTRY_PORT}/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
      ready=1
      break
    fi
    sleep 0.2
  done

  if [ "$ready" -ne 1 ]; then
    fail "mock registry failed to start"
    if [ -f /tmp/askill-mock-registry.log ]; then
      sed 's/^/    /' /tmp/askill-mock-registry.log || true
    fi
    stop_mock_registry
    return 1
  fi
}

trap stop_mock_registry EXIT


# ════════════════════════════════════════════════════
# Test: Banner (no args)
# ════════════════════════════════════════════════════
test_banner() {
  header "Banner (no args)"
  local output
  output=$($CLI 2>&1) || true

  assert_contains "$output" "askill" "shows product name"
  assert_contains "$output" "askill.sh" "shows registry URL"
  assert_contains "$output" "add" "shows add command"
  assert_contains "$output" "find" "shows find command"
}

# ════════════════════════════════════════════════════
# Test: Help
# ════════════════════════════════════════════════════
test_help() {
  header "Help (--help)"
  local output
  output=$($CLI --help 2>&1) || true

  assert_contains "$output" "Usage" "shows usage"
  assert_contains "$output" "owner/repo" "shows new source format"
  assert_contains "$output" "Install Options" "shows install options"
  assert_contains "$output" "--global" "shows global flag"
  assert_contains "$output" "--yes" "shows yes flag"
  assert_contains "$output" "--copy" "shows copy flag"
}

# ════════════════════════════════════════════════════
# Test: Submit command - invalid URL
# ════════════════════════════════════════════════════
test_submit_invalid_url() {
  header "Submit - invalid URL"

  local output
  output=$($CLI submit https://example.com 2>&1) || true

  assert_contains "$output" "Not a valid GitHub URL" "rejects non-GitHub URL"
}

# ════════════════════════════════════════════════════
# Test: Login command - invalid token
# ════════════════════════════════════════════════════
test_login_invalid_token() {
  header "Login - invalid token"
  clean_workspace

  local output
  output=$($CLI login --token ask_invalid_token_value 2>&1) || true

  assert_contains "$output" "Invalid token" "login reports invalid token"
}

# ════════════════════════════════════════════════════
# Test: Whoami command - not logged in
# ════════════════════════════════════════════════════
test_whoami_not_logged_in() {
  header "Whoami - not logged in"
  clean_workspace

  local output
  output=$($CLI whoami 2>&1) || true

  assert_contains "$output" "Not logged in" "whoami requires login"
}

# ════════════════════════════════════════════════════
# Test: Logout command clears credentials
# ════════════════════════════════════════════════════
test_logout_clears_credentials() {
  header "Logout - clears credentials"
  clean_workspace

  mkdir -p /root/.askill
  cat > /root/.askill/credentials.json <<'JSON'
{
  "token": "ask_test_token",
  "username": "tester"
}
JSON

  local output
  output=$($CLI logout 2>&1) || true

  assert_contains "$output" "Logged out" "logout reports success"

  if [ ! -f "/root/.askill/credentials.json" ]; then
    pass "credentials file removed"
  else
    fail "credentials file still exists after logout"
  fi
}

# ════════════════════════════════════════════════════
# Test: Publish command - requires login
# ════════════════════════════════════════════════════
test_publish_requires_login() {
  header "Publish - requires login"
  clean_workspace

  mkdir -p "$WORKSPACE/publish-no-login"
  cat > "$WORKSPACE/publish-no-login/SKILL.md" <<'SKILL'
---
name: publish-no-login
slug: publish-no-login
description: publish requires login test
version: 1.0.0
---

# test
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI publish publish-no-login 2>&1) || true

  assert_contains "$output" "Not logged in" "publish requires login"
}

# ════════════════════════════════════════════════════
# Test: Publish command - local validation
# ════════════════════════════════════════════════════
test_publish_local_validation() {
  header "Publish - local metadata validation"
  clean_workspace

  mkdir -p /root/.askill
  cat > /root/.askill/credentials.json <<'JSON'
{
  "token": "ask_fake_token",
  "username": "tester"
}
JSON

  mkdir -p "$WORKSPACE/publish-test"
  cat > "$WORKSPACE/publish-test/SKILL.md" <<'SKILL'
---
name: test-publish
slug: test-publish
description: publish validation test
version: not-semver
---

# test
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI publish publish-test 2>&1) || true

  assert_contains "$output" "Invalid semver version" "publish validates version before API call"
}

# ════════════════════════════════════════════════════
# Test: Publish --github command - URL validation
# ════════════════════════════════════════════════════
test_publish_github_url_validation() {
  header "Publish --github - URL validation"
  clean_workspace

  mkdir -p /root/.askill
  cat > /root/.askill/credentials.json <<'JSON'
{
  "token": "ask_fake_token",
  "username": "tester"
}
JSON

  local output
  output=$(cd "$WORKSPACE" && $CLI publish --github https://github.com/foo/bar 2>&1) || true

  assert_contains "$output" "Invalid GitHub file URL" "publish --github validates blob URL"
}

# ════════════════════════════════════════════════════
# Test: Version
# ════════════════════════════════════════════════════
test_version() {
  header "Version (--version)"
  local output
  output=$($CLI --version 2>&1) || true

  assert_contains "$output" "$(cli_version)" "shows version number"
}

# ════════════════════════════════════════════════════
# Test: Unknown command
# ════════════════════════════════════════════════════
test_unknown_command() {
  header "Unknown command"
  local output
  output=$($CLI foobar 2>&1) || true

  assert_contains "$output" "Unknown command" "rejects unknown command"
}

# ════════════════════════════════════════════════════
# Test: Add missing skill name
# ════════════════════════════════════════════════════
test_add_missing_name() {
  header "Add - missing skill name"
  local output
  output=$($CLI add 2>&1) || true

  assert_contains "$output" "Missing skill identifier" "shows error"
  assert_contains "$output" "owner/repo" "shows format hint"
}

# ════════════════════════════════════════════════════
# Test: Search (API)
# ════════════════════════════════════════════════════
test_search() {
  header "Search"
  local output
  output=$($CLI search memory 2>&1) || true

  # If API is reachable, we get results; if not, we get an error
  if output_matches "$output" "result\|found\|memory"; then
    pass "search returns results or reports count"
    # Verify web links are shown in results
    if output_matches "$output" "askill\.sh/skills/[0-9]"; then
      pass "search results include web links"
    else
      fail "search results missing web links (askill.sh/skills/<id>)"
    fi
  elif output_matches "$output" "failed\|error\|ENOTFOUND"; then
    fail "API not reachable"
    echo "$output" | strip_ansi | head -5 | sed 's/^/    /'
  else
    fail "unexpected search output"
    echo "$output" | strip_ansi | head -3 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: List (empty)
# ════════════════════════════════════════════════════
test_list_empty() {
  header "List (empty)"
  clean_workspace

  local output
  output=$(cd "$WORKSPACE" && $CLI list 2>&1) || true

  if output_matches "$output" "0 skill\|No skills installed"; then
    pass "shows no skills"
  else
    fail "shows no skills"
  fi
}

# ════════════════════════════════════════════════════
# Test: Install from local path
# ════════════════════════════════════════════════════
test_install_local() {
  header "Install from local path"
  clean_workspace

  # Use the bundled skill as local source
  local output
  output=$(cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y 2>&1) || true

  assert_contains "$output" "discover-a-skill" "installs discover-a-skill skill"

  # Verify files were created
  if [ -f "$WORKSPACE/.claude/skills/discover-a-skill/SKILL.md" ]; then
    pass "SKILL.md created in .claude/skills/discover-a-skill/"
  else
    # Check if symlink target exists
    if [ -L "$WORKSPACE/.claude/skills/discover-a-skill" ] && [ -f "$WORKSPACE/.claude/skills/discover-a-skill/SKILL.md" ]; then
      pass "SKILL.md accessible via symlink in .claude/skills/discover-a-skill/"
    else
      fail "SKILL.md not found in .claude/skills/discover-a-skill/"
      info "Contents of .claude/skills/:"
      ls -la "$WORKSPACE/.claude/skills/" 2>/dev/null | sed 's/^/    /' || true
    fi
  fi
}

# ════════════════════════════════════════════════════
# Test: Install from local path then list
# ════════════════════════════════════════════════════
test_install_then_list() {
  header "Install → List"
  clean_workspace

  # Install
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  # List
  local output
  output=$(cd "$WORKSPACE" && $CLI list 2>&1) || true

  assert_contains "$output" "discover-a-skill" "lists installed skill"
}

# ════════════════════════════════════════════════════
# Test: Install from local path then remove
# ════════════════════════════════════════════════════
test_install_then_remove() {
  header "Install → Remove"
  clean_workspace

  # Install
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  # Verify installed
  if [ ! -e "$WORKSPACE/.claude/skills/discover-a-skill" ]; then
    fail "skill not installed, cannot test removal"
    return
  fi

  # Remove (non-interactive JSON mode)
  local output
  output=$(cd "$WORKSPACE" && $CLI remove discover-a-skill --json 2>&1) || true

  assert_contains "$output" '"ok": true' "remove --json succeeds"

  # Verify removed
  if [ ! -e "$WORKSPACE/.claude/skills/discover-a-skill" ]; then
    pass "skill removed from .claude/skills/"
  else
    fail "skill still exists after removal"
  fi
}

# ════════════════════════════════════════════════════
# Test: Install to multiple agents
# ════════════════════════════════════════════════════
test_install_multi_agent() {
  header "Install to multiple agents"
  clean_workspace

  local output
  output=$(cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code cursor -y 2>&1) || true

  assert_contains "$output" "2 agent" "installs to 2 agents"

  local found=0
  [ -e "$WORKSPACE/.claude/skills/discover-a-skill" ] && ((found++)) || true
  [ -e "$WORKSPACE/.cursor/skills/discover-a-skill" ] && ((found++)) || true

  if [ "$found" -eq 2 ]; then
    pass "skill present in both agent directories"
  else
    fail "skill found in only $found/2 agent directories"
  fi
}

# ════════════════════════════════════════════════════
# Test: Install globally
# ════════════════════════════════════════════════════
test_install_global() {
  header "Install globally"
  clean_workspace

  local output
  output=$(cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -g -y 2>&1) || true

  # Global install goes to ~/.claude/skills/
  if [ -e "/root/.claude/skills/discover-a-skill" ]; then
    pass "skill installed globally to ~/.claude/skills/"
  else
    fail "skill not found at ~/.claude/skills/discover-a-skill"
    info "Contents of ~/.claude/:"
    ls -la /root/.claude/ 2>/dev/null | sed 's/^/    /' || true
  fi

  if [ -f "$GLOBAL_LOCK" ]; then
    pass "global install writes global lock file"
  else
    fail "global install did not write global lock file"
  fi

  if [ ! -f "$PROJECT_LOCK" ]; then
    pass "global install does not write project lock file"
  else
    fail "global install unexpectedly wrote project lock file"
  fi
}

# ════════════════════════════════════════════════════
# Test: Install with --copy mode
# ════════════════════════════════════════════════════
test_install_copy_mode() {
  header "Install --copy mode"
  clean_workspace

  local output
  output=$(cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code --copy -y 2>&1) || true

  if [ -d "$WORKSPACE/.claude/skills/discover-a-skill" ] && [ ! -L "$WORKSPACE/.claude/skills/discover-a-skill" ]; then
    pass "installed as directory (not symlink) in copy mode"
  elif [ -L "$WORKSPACE/.claude/skills/discover-a-skill" ]; then
    fail "installed as symlink, expected copy"
  else
    fail "skill not installed"
  fi
}

# ════════════════════════════════════════════════════
# Test: Install from git clone (GitHub repo)
# ════════════════════════════════════════════════════
test_install_git_clone() {
  header "Install from git clone (GitHub)"
  clean_workspace

  # Use a known small repo with SKILL.md files
  # This tests the full clone → discover → install flow
  local output
  output=$(cd "$WORKSPACE" && timeout 30 $CLI add avibe-bot/askill@discover-a-skill -a claude-code -y 2>&1) || true

  if output_matches "$output" "skill\|installed\|Done"; then
    pass "clone-based install completes"
    assert_not_contains "$output" "Error" "no errors during install"
  elif output_matches "$output" "Clone failed\|timed out\|not found\|No skills found"; then
    fail "clone failed (network or repo issue)"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  else
    fail "unexpected output from clone install"
    echo "$output" | strip_ansi | head -5 | sed 's/^/    /'
  fi

  # Verify tempDir was cleaned up
  local leftover
  leftover=$(find /tmp -maxdepth 1 -name 'askill-*' -type d 2>/dev/null | wc -l)
  leftover=$(echo "$leftover" | tr -d ' ')
  if [ "$leftover" -eq 0 ]; then
    pass "temp directories cleaned up"
  else
    fail "$leftover temp directories left behind"
    ls -d /tmp/askill-* 2>/dev/null | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Config persistence (preferred agents via lock file)
# ════════════════════════════════════════════════════
test_config_persistence() {
  header "Config persistence"
  clean_workspace

  # Remove any existing files
  rm -f "$PROJECT_LOCK" "$GLOBAL_LOCK"
  rm -f /root/.config/askill/config.json

  # First install - should save preferred agents to lock file
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  # Check project lock file (default project install scope)
  if [ -f "$PROJECT_LOCK" ]; then
    pass "lock file created"
    local content
    content=$(cat "$PROJECT_LOCK")
    assert_contains "$content" "claude-code" "preferred agents saved in lock file"
  else
    fail "lock file not created at project .agents/.skill-lock.json"
  fi
}

# ════════════════════════════════════════════════════
# Test: Install local directory with multiple skills
# ════════════════════════════════════════════════════
test_install_multi_skill_dir() {
  header "Install directory with multiple skills"
  clean_workspace

  # Create a temp directory with 2 skills
  local src="/tmp/test-multi-skills"
  rm -rf "$src"
  mkdir -p "$src/skills/skill-a" "$src/skills/skill-b"

  cat > "$src/skills/skill-a/SKILL.md" <<'SKILL'
---
name: test-skill-a
description: Test skill A for e2e testing
version: 1.0.0
---

# Test Skill A

This is a test skill.
SKILL

  cat > "$src/skills/skill-b/SKILL.md" <<'SKILL'
---
name: test-skill-b
description: Test skill B for e2e testing
version: 1.0.0
---

# Test Skill B

This is another test skill.
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI add "$src" -a claude-code -y 2>&1) || true

  assert_contains "$output" "2 skill" "discovers 2 skills"
  assert_contains "$output" "test-skill-a" "installs skill A"
  assert_contains "$output" "test-skill-b" "installs skill B"

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: Source parser formats
# ════════════════════════════════════════════════════
test_source_parser() {
  header "Source parser (format variations)"

  # Test that various formats are accepted (don't need actual repos, just check parsing)
  # We test by looking at the spinner/error messages which reveal what was parsed

  # owner/repo format
  local output
  output=$(cd "$WORKSPACE" && timeout 10 $CLI add nonexistent/fakerepo -y 2>&1) || true
  if output_matches "$output" "cloning\|clone\|fakerepo"; then
    pass "owner/repo: triggers clone"
  else
    skip "owner/repo format: could not verify"
  fi

  # owner/repo@skill format
  output=$(cd "$WORKSPACE" && timeout 10 $CLI add nonexistent/fakerepo@myskill -y 2>&1) || true
  if output_matches "$output" "cloning\|clone\|fakerepo"; then
    pass "owner/repo@skill: triggers clone"
  else
    skip "owner/repo@skill format: could not verify"
  fi

  # @author/slug format should route through registry parser (no malformed GitHub clone)
  output=$(cd "$WORKSPACE" && timeout 30 $CLI add @avibe-bot/discover-a-skill --list 2>&1) || true
  assert_not_contains "$output" "github.com/@" "@author/slug: does not attempt GitHub clone"
  assert_contains "$output" "Skill not found" "@author/slug: reports not found when slug is unavailable"
}

# ════════════════════════════════════════════════════
# Test: Collection source in help
# ════════════════════════════════════════════════════
test_help_collection_sources() {
  header "Help shows collection sources"

  local output
  output=$($CLI --help 2>&1) || true

  assert_contains "$output" "col:owner/collection-handle" "help shows collection shorthand"
  assert_contains "$output" "https://askill.sh/c/owner/handle" "help shows collection URL"
}

# ════════════════════════════════════════════════════
# Test: Install from shared collection source
# ════════════════════════════════════════════════════
test_install_collection_source() {
  header "Install from shared collection source"
  clean_workspace

  start_mock_registry || return

  local output
  output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="http://127.0.0.1:${MOCK_REGISTRY_PORT}" ASKILL_API_BASE_URL="http://127.0.0.1:${MOCK_REGISTRY_PORT}/api/v1" $CLI add col:mock/dev-tools--grp123 -a claude-code -y 2>&1) || true

  assert_contains "$output" "Skipped 1 collection entry" "collection reports skipped entries"
  assert_contains "$output" "alpha-collection-skill" "installs alpha collection skill"
  assert_contains "$output" "beta-collection-skill" "installs beta collection skill"

  if [ -e "$WORKSPACE/.claude/skills/alpha-collection-skill" ] && [ -e "$WORKSPACE/.claude/skills/beta-collection-skill" ]; then
    pass "collection skills installed into agent directory"
  else
    fail "collection skills not installed into expected directories"
  fi

  if [ -f "$PROJECT_LOCK" ]; then
    local lock
    lock=$(cat "$PROJECT_LOCK")
    assert_contains "$lock" '"@mock/alpha"' "lock records per-skill registry source"
    assert_contains "$lock" '"@mock/beta"' "lock records second per-skill registry source"
  else
    fail "lock file missing after collection install"
  fi

  stop_mock_registry
}

# ════════════════════════════════════════════════════
# Test: Install from shared collection URL
# ════════════════════════════════════════════════════
test_install_collection_url_source() {
  header "Install from shared collection URL"
  clean_workspace

  start_mock_registry || return

  local output
  output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="http://127.0.0.1:${MOCK_REGISTRY_PORT}" ASKILL_API_BASE_URL="http://127.0.0.1:${MOCK_REGISTRY_PORT}/api/v1" $CLI add https://askill.sh/c/mock/dev-tools--grp123 -a claude-code -y 2>&1) || true

  assert_contains "$output" "alpha-collection-skill" "collection URL installs alpha skill"
  assert_contains "$output" "beta-collection-skill" "collection URL installs beta skill"

  stop_mock_registry
}

# ════════════════════════════════════════════════════
# Test: Install collection from PRODUCTION (real askill.sh)
# ════════════════════════════════════════════════════
test_install_collection_production() {
  header "Install collection from production (col:cyhhao/test)"
  clean_workspace

  local output
  output=$(cd "$WORKSPACE" && \
    ASKILL_API_BASE_URL="https://askill.sh/api/v1" \
    timeout 120 $CLI add col:cyhhao/test -a claude-code -y 2>&1) || true

  if echo "$output" | strip_ansi | grep -qi "Collection not found"; then
    skip "production collection fixture is unavailable"
    return
  fi

  # Verify the CLI processed the collection (check for skill names or install messages)
  # The collection "test" has skills like flowio, beautiful-mermaid, whisper, discover-a-skill
  if echo "$output" | strip_ansi | grep -qiE "Installing|skill\(s\) in collection|Installed"; then
    pass "output shows install activity for collection"
  else
    fail "output does not show install activity"
    echo "$output" | strip_ansi | head -15 | sed 's/^/    /'
  fi

  # Count how many skill directories were actually installed
  local installed_count=0
  if [ -d "$WORKSPACE/.claude/skills" ]; then
    installed_count=$(ls -1d "$WORKSPACE/.claude/skills"/*/ 2>/dev/null | wc -l | tr -d ' ')
  fi

  if [ "$installed_count" -ge 1 ]; then
    pass "installed $installed_count skill(s) from production collection"
  else
    fail "no skills installed from production collection"
    echo -e "${DIM}    output (first 10 lines):${RESET}"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  # Verify lock file was created with real sources
  if [ -f "$PROJECT_LOCK" ]; then
    pass "lock file created after production collection install"
  else
    fail "lock file missing after production collection install"
  fi
}

# ════════════════════════════════════════════════════
# Test: Install indexed GitHub slug (gh:owner/repo@skill)
# ════════════════════════════════════════════════════
test_install_published_slug() {
  header "Install indexed GitHub slug (gh:owner/repo@skill)"
  clean_workspace

  local output
  output=$(cd "$WORKSPACE" && timeout 30 $CLI add gh:avibe-bot/askill@discover-a-skill -a claude-code -y 2>&1) || true

  # Verify install actually happened
  if [ -f "$WORKSPACE/.claude/skills/discover-a-skill/SKILL.md" ]; then
    pass "SKILL.md installed to .claude/skills/discover-a-skill/"
  else
    fail "SKILL.md not found after published slug install"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Symlink mode (default)
# ════════════════════════════════════════════════════
test_symlink_mode() {
  header "Symlink mode (default)"
  clean_workspace

  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  if [ -L "$WORKSPACE/.claude/skills/discover-a-skill" ]; then
    pass "installed as symlink"
    # Verify canonical location
    if [ -d "$WORKSPACE/.agents/skills/discover-a-skill" ]; then
      pass "canonical directory created at .agents/skills/"
    else
      fail "canonical directory not found"
    fi
  elif [ -d "$WORKSPACE/.claude/skills/discover-a-skill" ]; then
    # Symlink may have failed, copy fallback is OK
    pass "installed as directory (symlink fallback)"
  else
    fail "skill not installed"
  fi
}

# ════════════════════════════════════════════════════
# Test: Info command
# ════════════════════════════════════════════════════
test_info() {
  header "Info command"

  local output
  output=$(timeout 10 $CLI info gh:avibe-bot/askill@discover-a-skill 2>&1) || true

  assert_contains "$output" "Owner" "info shows Owner"
  assert_contains "$output" "Repository" "info shows Repository"
  assert_contains "$output" "Install" "info shows Install"
}

# ════════════════════════════════════════════════════
# Test: Product lifecycle (CLI-only)
# ════════════════════════════════════════════════════
test_product_lifecycle_cli_only() {
  header "Product lifecycle (CLI-only)"
  clean_workspace

  start_mock_registry || return

  local registry_url="http://127.0.0.1:${MOCK_REGISTRY_PORT}"
  local api_url="${registry_url}/api/v1"

  local before_output
  before_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI list --json 2>&1) || true

  if echo "$before_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (data.count !== 0) process.exit(1);
    if (!Array.isArray(data.skills) || data.skills.length !== 0) process.exit(1);
  '; then
    pass "lifecycle starts from empty local state"
  else
    fail "lifecycle precondition failed (list should be empty)"
    echo "$before_output" | strip_ansi | head -10 | sed 's/^/    /'
    stop_mock_registry
    return
  fi

  local explore_output
  explore_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI find alpha --json 2>&1) || true

  if echo "$explore_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (data.query !== "alpha") process.exit(1);
    if (!Array.isArray(data.skills) || data.skills.length < 1) process.exit(1);
    const target = data.skills.find((skill) => skill.name === "alpha-collection-skill");
    if (!target) process.exit(1);
    if (target.owner !== "mock" || target.repo !== "skills") process.exit(1);
    if (target.installSource !== "gh:mock/skills@alpha-collection-skill") process.exit(1);
  '; then
    pass "find --json discovers installable skill"
  else
    fail "find --json did not return expected discoverability payload"
    echo "$explore_output" | strip_ansi | head -10 | sed 's/^/    /'
    stop_mock_registry
    return
  fi

  local info_output
  info_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI info @mock/alpha 2>&1) || true

  assert_contains "$info_output" "alpha-collection-skill" "info shows skill name"
  assert_contains "$info_output" "Owner" "info shows owner label"
  assert_contains "$info_output" "mock" "info shows owner value"
  assert_contains "$info_output" "Repository" "info shows repository label"
  assert_contains "$info_output" "mock/skills" "info shows repository value"
  assert_contains "$info_output" "askill install gh:mock/skills@alpha-collection-skill" "info shows install command"

  local install_output
  install_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI add @mock/alpha -a claude-code -y --json 2>&1) || true

  if echo "$install_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (data.action !== "install") process.exit(1);
    if (!data.summary || data.summary.failed !== 0) process.exit(1);
    if (!Array.isArray(data.results) || data.results.length < 1) process.exit(1);
    const installed = data.results.find((result) => result.skill === "alpha-collection-skill" && result.success === true);
    if (!installed) process.exit(1);
    if (!installed.agent || installed.agent.id !== "claude-code") process.exit(1);
  '; then
    pass "add --json installs selected skill"
  else
    fail "add --json install payload mismatch in lifecycle"
    echo "$install_output" | strip_ansi | head -10 | sed 's/^/    /'
    stop_mock_registry
    return
  fi

  local after_install_output
  after_install_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI list --json 2>&1) || true

  if echo "$after_install_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (!Array.isArray(data.skills) || data.skills.length < 1) process.exit(1);
    const target = data.skills.find((skill) => skill.name === "alpha-collection-skill");
    if (!target) process.exit(1);
    if (target.scope !== "project") process.exit(1);
    if (typeof target.path !== "string" || target.path.length === 0) process.exit(1);
    if (!Array.isArray(target.agents) || !target.agents.some((agent) => agent.id === "claude-code")) process.exit(1);
  '; then
    pass "list --json shows installed skill state"
  else
    fail "list --json missing installed skill in lifecycle"
    echo "$after_install_output" | strip_ansi | head -10 | sed 's/^/    /'
    stop_mock_registry
    return
  fi

  local installed_path
  installed_path=$(echo "$after_install_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const target = (data.skills || []).find((skill) => skill.name === "alpha-collection-skill");
    if (target && typeof target.path === "string") {
      process.stdout.write(target.path);
    }
  ')

  if [ -z "$installed_path" ]; then
    fail "could not derive installed skill path from list --json"
    stop_mock_registry
    return
  fi

  local remove_output
  remove_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI remove "$installed_path" --json 2>&1) || true

  if echo "$remove_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (data.skill !== "alpha-collection-skill") process.exit(1);
    if (!Array.isArray(data.removedAgents) || data.removedAgents.length !== 1) process.exit(1);
    if (!data.removedAgents[0] || data.removedAgents[0].id !== "claude-code") process.exit(1);
    if (!Array.isArray(data.failed) || data.failed.length !== 0) process.exit(1);
  '; then
    pass "remove --json removes skill by installed path"
  else
    fail "remove --json path removal payload mismatch"
    echo "$remove_output" | strip_ansi | head -10 | sed 's/^/    /'
    stop_mock_registry
    return
  fi

  local final_output
  final_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI list --json 2>&1) || true

  if echo "$final_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (data.count !== 0) process.exit(1);
    if (!Array.isArray(data.skills) || data.skills.length !== 0) process.exit(1);
  '; then
    pass "lifecycle ends with empty state after removal"
  else
    fail "final list state mismatch after lifecycle remove"
    echo "$final_output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  stop_mock_registry
}


# ════════════════════════════════════════════════════
# Test: Skill lock file written on install
# ════════════════════════════════════════════════════
test_lock_file_install() {
  header "Lock file - written on install"
  clean_workspace

  # Remove any existing lock file
  rm -f "$PROJECT_LOCK" "$GLOBAL_LOCK"

  # Install a skill
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  if [ -f "$PROJECT_LOCK" ]; then
    pass "lock file created at project .agents/.skill-lock.json"

    local content
    content=$(cat "$PROJECT_LOCK")

    # Check structure
    assert_contains "$content" '"version"' "has version field"
    assert_contains "$content" '"skills"' "has skills map"
    assert_contains "$content" '"discover-a-skill"' "contains installed skill name"
    assert_contains "$content" '"source"' "has source field"
    assert_contains "$content" '"sourceType"' "has sourceType field"
    assert_contains "$content" '"installedAt"' "has installedAt timestamp"
    assert_contains "$content" '"updatedAt"' "has updatedAt timestamp"
    assert_contains "$content" '"lastSelectedAgents"' "has lastSelectedAgents"
    assert_contains "$content" '"claude-code"' "lastSelectedAgents includes claude-code"
  else
    fail "lock file not created"
  fi
}

# ════════════════════════════════════════════════════
# Test: Skill lock file cleaned on remove
# ════════════════════════════════════════════════════
test_lock_file_remove() {
  header "Lock file - cleaned on remove"
  clean_workspace

  # Remove any existing lock file
  rm -f "$PROJECT_LOCK" "$GLOBAL_LOCK"

  # Install
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  # Verify it's in lock
  if [ ! -f "$PROJECT_LOCK" ]; then
    fail "lock file not created, cannot test removal"
    return
  fi

  local before
  before=$(cat "$PROJECT_LOCK")
  assert_contains "$before" '"discover-a-skill"' "skill in lock before removal"

  # Remove (non-interactive JSON mode)
  cd "$WORKSPACE" && $CLI remove discover-a-skill --json >/dev/null 2>&1 || true

  # Verify skill is removed from lock but file still exists
  if [ -f "$PROJECT_LOCK" ]; then
    local after
    after=$(cat "$PROJECT_LOCK")
    if echo "$after" | grep -q '"discover-a-skill"'; then
      fail "skill still in lock file after removal"
    else
      pass "skill removed from lock file"
    fi
  else
    fail "lock file deleted entirely (should still exist)"
  fi
}

# ════════════════════════════════════════════════════
# Test: Lock file version compatibility
# ════════════════════════════════════════════════════
test_lock_file_version() {
  header "Lock file - version compatibility"
  clean_workspace

  # Remove any existing lock file
  rm -f "$PROJECT_LOCK" "$GLOBAL_LOCK"

  # Install to create lock
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  if [ -f "$PROJECT_LOCK" ]; then
    local content
    content=$(cat "$PROJECT_LOCK")
    # Should be version 3 (Vercel Skills compatible)
    assert_contains "$content" '"version": 3' "version is 3 (Vercel compatible)"
  else
    fail "lock file not created"
  fi
}

# ════════════════════════════════════════════════════
# Test: Project/global lock scope isolation
# ════════════════════════════════════════════════════
test_lock_file_scope_isolation() {
  header "Lock file - project/global scope isolation"
  clean_workspace

  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -g -y >/dev/null 2>&1 || true

  if [ -f "$GLOBAL_LOCK" ]; then
    pass "global install creates global lock"
  else
    fail "global lock missing after global install"
    return
  fi

  if [ ! -f "$PROJECT_LOCK" ]; then
    pass "project lock remains absent after global install"
  else
    fail "project lock should not be created by global install"
  fi

  local project_output
  project_output=$(cd "$WORKSPACE" && $CLI check 2>&1) || true
  assert_contains "$project_output" "project lock file" "default check reads project lock"

  local global_output
  global_output=$(cd "$WORKSPACE" && $CLI check -g 2>&1) || true
  assert_contains "$global_output" "1 tracked" "check -g reads global lock"
}

# ════════════════════════════════════════════════════
# Test: Legacy global lock migration for project installs
# ════════════════════════════════════════════════════
test_lock_file_legacy_migration() {
  header "Lock file - legacy global migration"
  clean_workspace

  mkdir -p "$(dirname "$GLOBAL_LOCK")" "$WORKSPACE/.agents/skills/legacy-project-skill"
  cat > "$WORKSPACE/.agents/skills/legacy-project-skill/SKILL.md" <<'SKILL'
---
name: legacy-project-skill
description: Legacy project skill
version: 1.0.0
---

# Legacy Project Skill
SKILL

  cat > "$GLOBAL_LOCK" <<'JSON'
{
  "version": 3,
  "lastSelectedAgents": ["claude-code"],
  "skills": {
    "legacy-project-skill": {
      "source": "/legacy/project",
      "sourceType": "local",
      "sourceUrl": "/legacy/project",
      "skillFolderHash": "",
      "installedAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    },
    "other-project-skill": {
      "source": "/legacy/other",
      "sourceType": "local",
      "sourceUrl": "/legacy/other",
      "skillFolderHash": "",
      "installedAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
JSON

  local output
  output=$(cd "$WORKSPACE" && $CLI check 2>&1) || true
  assert_contains "$output" "1 tracked" "default check migrates matching project entry"

  if [ -f "$PROJECT_LOCK" ]; then
    pass "project lock created by legacy migration"
  else
    fail "project lock missing after legacy migration"
    return
  fi

  local migrated
  migrated=$(cat "$PROJECT_LOCK")
  assert_contains "$migrated" '"legacy-project-skill"' "project lock contains matching legacy skill"
  assert_not_contains "$migrated" '"other-project-skill"' "project lock excludes unrelated legacy skill"
  assert_contains "$migrated" '"claude-code"' "project lock preserves selected agents"
}


# ════════════════════════════════════════════════════
# Test: Check command - no skills installed
# ════════════════════════════════════════════════════
test_check_empty() {
  header "Check - no skills installed"
  clean_workspace

  # Remove any existing lock file
  rm -f "$PROJECT_LOCK" "$GLOBAL_LOCK"

  local output
  output=$(cd "$WORKSPACE" && $CLI check 2>&1) || true

  assert_contains "$output" "No" "reports no skills tracked"
}

# ════════════════════════════════════════════════════
# Test: Check command - local source (uncheckable)
# ════════════════════════════════════════════════════
test_check_local_source() {
  header "Check - local source (uncheckable)"
  clean_workspace

  # Remove any existing lock file
  rm -f "$PROJECT_LOCK" "$GLOBAL_LOCK"

  # Install from local path (creates a lock entry with sourceType=local)
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  # Check should report as uncheckable since it's a local source
  local output
  output=$(cd "$WORKSPACE" && $CLI check 2>&1) || true

  assert_contains "$output" "1 tracked" "finds 1 tracked skill"
  # Should either show 'local source' or 'up to date' (all up to date message)
  if output_matches "$output" "local source\|uncheckable\|up to date\|All up to date"; then
    pass "handles local source correctly"
  else
    fail "unexpected check output for local source"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Check command - help text shown in help
# ════════════════════════════════════════════════════
test_help_includes_check() {
  header "Help includes check/update commands"

  local output
  output=$($CLI --help 2>&1) || true

  assert_contains "$output" "check" "help shows check command"
  assert_contains "$output" "update" "help shows update command"
  assert_contains "$output" "upgrade" "help shows upgrade command"

  local check_help
  check_help=$($CLI check --help 2>&1) || true
  assert_contains "$check_help" "--global" "check help shows global option"

  local update_help
  update_help=$($CLI update --help 2>&1) || true
  assert_contains "$update_help" "--global" "update help shows global option"
}

# ════════════════════════════════════════════════════
# Test: Update command - nothing to update
# ════════════════════════════════════════════════════
test_update_noop() {
  header "Update - nothing to update"
  clean_workspace

  # Remove any existing lock file
  rm -f "$PROJECT_LOCK" "$GLOBAL_LOCK"

  # Install from local (can't check for updates)
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  local output
  output=$(cd "$WORKSPACE" && $CLI update -y 2>&1) || true

  # Should either report "All skills up to date" or "Nothing to update"
  if output_matches "$output" "up to date\|Nothing to update"; then
    pass "reports nothing to update"
  else
    fail "unexpected update output"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Update command - empty lock file
# ════════════════════════════════════════════════════
test_update_empty() {
  header "Update - no skills tracked"
  clean_workspace

  # Remove any existing lock file
  rm -f "$PROJECT_LOCK" "$GLOBAL_LOCK"

  local output
  output=$(cd "$WORKSPACE" && $CLI update -y 2>&1) || true

  assert_contains "$output" "No" "reports no skills tracked"
}

# ════════════════════════════════════════════════════
# Test: Check after git install (network test)
# ════════════════════════════════════════════════════
test_check_after_git_install() {
  header "Check after git install (network)"
  clean_workspace

  # Remove any existing lock file
  rm -f "$PROJECT_LOCK" "$GLOBAL_LOCK"

  # Install from GitHub - use a known small repo
  local output
  output=$(cd "$WORKSPACE" && timeout 30 $CLI add avibe-bot/askill@discover-a-skill -a claude-code -y 2>&1) || true

  # Determine success by lock file existence (output may include clone fallback warnings)
  if [ ! -f "$PROJECT_LOCK" ]; then
    fail "git install did not create lock file"
    echo "$output" | strip_ansi | head -15 | sed 's/^/    /'
    return
  fi

  local lock
  lock=$(cat "$PROJECT_LOCK")
  assert_contains "$lock" "avibe-bot/askill" "lock file records GitHub source"

  # Now run check - should report up to date (just installed)
  output=$(cd "$WORKSPACE" && timeout 30 $CLI check 2>&1) || true

  if output_matches "$output" "up to date\|All up to date\|0 update"; then
    pass "freshly installed skills are up to date"
  elif output_matches "$output" "update.*available\|uncheckable\|could not"; then
    fail "check result inconclusive"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  else
    fail "unexpected check output after git install"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Init command
# ════════════════════════════════════════════════════
test_init() {
  header "Init command"
  clean_workspace

  # Create a temp directory for the skill
  local skill_dir="$WORKSPACE/my-test-skill"
  mkdir -p "$skill_dir"

  # Run init with -y for non-interactive
  local output
  output=$(cd "$skill_dir" && $CLI init -y 2>&1) || true

  assert_contains "$output" "Created" "reports file created"
  
  # Verify SKILL.md was created
  if [ -f "$skill_dir/SKILL.md" ]; then
    pass "SKILL.md created"
    local content
    content=$(cat "$skill_dir/SKILL.md")
    assert_contains "$content" "name:" "SKILL.md has name field"
    assert_contains "$content" "description:" "SKILL.md has description field"
    assert_contains "$content" "version:" "SKILL.md has version field"
  else
    fail "SKILL.md not created"
  fi

  rm -rf "$skill_dir"
}

# ════════════════════════════════════════════════════
# Test: Init command - already exists
# ════════════════════════════════════════════════════
test_init_already_exists() {
  header "Init - SKILL.md already exists"
  clean_workspace

  local skill_dir="$WORKSPACE/existing-skill"
  mkdir -p "$skill_dir"
  echo "existing content" > "$skill_dir/SKILL.md"

  local output
  output=$(cd "$skill_dir" && $CLI init -y 2>&1) || true

  assert_contains "$output" "already exists" "reports file already exists"
  
  # Content should be unchanged
  local content
  content=$(cat "$skill_dir/SKILL.md")
  assert_contains "$content" "existing content" "original content preserved"

  rm -rf "$skill_dir"
}

# ════════════════════════════════════════════════════
# Test: --list option
# ════════════════════════════════════════════════════
test_list_option() {
  header "Add --list option"
  clean_workspace

  # Create a multi-skill directory
  local src="/tmp/test-list-skills"
  rm -rf "$src"
  mkdir -p "$src/skill-one" "$src/skill-two"

  cat > "$src/skill-one/SKILL.md" <<'SKILL'
---
name: skill-one
description: First test skill
version: 1.0.0
---
# Skill One
SKILL

  cat > "$src/skill-two/SKILL.md" <<'SKILL'
---
name: skill-two
description: Second test skill
version: 1.0.0
---
# Skill Two
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI add "$src" --list 2>&1) || true

  assert_contains "$output" "skill-one" "lists skill-one"
  assert_contains "$output" "skill-two" "lists skill-two"
  assert_contains "$output" "2 skill" "reports 2 skills found"

  # Should NOT have installed anything
  if [ -e "$WORKSPACE/.agents/skills/skill-one" ]; then
    fail "skill-one was installed (should only list)"
  else
    pass "no skills installed in list mode"
  fi

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: --all option
# ════════════════════════════════════════════════════
test_all_option() {
  header "Add --all option"
  clean_workspace

  # Create a multi-skill directory
  local src="/tmp/test-all-skills"
  rm -rf "$src"
  mkdir -p "$src/alpha" "$src/beta"

  cat > "$src/alpha/SKILL.md" <<'SKILL'
---
name: alpha
description: Alpha skill
version: 1.0.0
---
# Alpha
SKILL

  cat > "$src/beta/SKILL.md" <<'SKILL'
---
name: beta
description: Beta skill
version: 1.0.0
---
# Beta
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI add "$src" --all -a claude-code -y 2>&1) || true

  assert_contains "$output" "alpha" "installs alpha"
  assert_contains "$output" "beta" "installs beta"
  assert_contains "$output" "2 skill" "reports 2 skills installed"

  # Verify both installed
  local count=0
  [ -e "$WORKSPACE/.claude/skills/alpha" ] && ((count++)) || true
  [ -e "$WORKSPACE/.claude/skills/beta" ] && ((count++)) || true

  if [ "$count" -eq 2 ]; then
    pass "both skills installed with --all"
  else
    fail "only $count/2 skills installed"
  fi

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: Help includes new options
# ════════════════════════════════════════════════════
test_help_new_options() {
  header "Help includes init/list/all"

  local output
  output=$($CLI --help 2>&1) || true

  assert_contains "$output" "init" "help shows init command"
  assert_contains "$output" "--list" "help shows --list option"
  assert_contains "$output" "--all" "help shows --all option"
}

# ════════════════════════════════════════════════════
# Test: Run command - missing target
# ════════════════════════════════════════════════════
test_run_missing_target() {
  header "Run - missing target"

  local output
  output=$($CLI run 2>&1) || true

  assert_contains "$output" "Missing run target" "shows missing target error"
}

# ════════════════════════════════════════════════════
# Test: Run command - invalid format
# ════════════════════════════════════════════════════
test_run_invalid_format() {
  header "Run - invalid format"

  local output
  output=$($CLI run no-colon-here 2>&1) || true

  assert_contains "$output" "Invalid run target" "shows invalid format error"
}

# ════════════════════════════════════════════════════
# Test: Run command - skill not found
# ════════════════════════════════════════════════════
test_run_skill_not_found() {
  header "Run - skill not found"
  clean_workspace

  local output
  output=$(cd "$WORKSPACE" && $CLI run nonexistent:build 2>&1) || true

  assert_contains "$output" "not found" "reports skill not found"
}

# ════════════════════════════════════════════════════
# Test: Run command - no commands defined
# ════════════════════════════════════════════════════
test_run_no_commands() {
  header "Run - no commands defined"
  clean_workspace

  # Install a skill without commands
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  local output
  output=$(cd "$WORKSPACE" && $CLI run discover-a-skill:build 2>&1) || true

  assert_contains "$output" "does not define any commands" "reports no commands"
}

# ════════════════════════════════════════════════════
# Test: Run command - execute a simple command
# ════════════════════════════════════════════════════
test_run_execute() {
  header "Run - execute command"
  clean_workspace

  # Create a skill with commands
  local src="/tmp/test-run-skill"
  rm -rf "$src"
  mkdir -p "$src/runnable"

  cat > "$src/runnable/SKILL.md" <<'SKILL'
---
name: runnable
description: A skill with runnable commands
version: 1.0.0
commands:
  greet:
    run: echo "Hello from runnable!"
    description: Print a greeting
  status:
    run: echo "status OK"
    description: Show status
  _setup:
    run: echo "setup done"
    description: Internal setup command
---

# Runnable Skill

A test skill with commands.
SKILL

  # Install it
  cd "$WORKSPACE" && $CLI add "$src" -a claude-code -y >/dev/null 2>&1 || true

  # Run the greet command
  local output
  output=$(cd "$WORKSPACE" && $CLI run runnable:greet 2>&1) || true

  assert_contains "$output" "Hello from runnable" "executes greet command"

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: Run command - command not found
# ════════════════════════════════════════════════════
test_run_command_not_found() {
  header "Run - command not found in skill"
  clean_workspace

  # Create a skill with commands
  local src="/tmp/test-run-notfound"
  rm -rf "$src"
  mkdir -p "$src/cmdskill"

  cat > "$src/cmdskill/SKILL.md" <<'SKILL'
---
name: cmdskill
description: Skill with limited commands
version: 1.0.0
commands:
  build:
    run: echo "building"
    description: Build stuff
---

# Command Skill
SKILL

  cd "$WORKSPACE" && $CLI add "$src" -a claude-code -y >/dev/null 2>&1 || true

  local output
  output=$(cd "$WORKSPACE" && $CLI run cmdskill:deploy 2>&1) || true

  assert_contains "$output" "not found" "reports command not found"
  assert_contains "$output" "build" "shows available commands"

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: Run command - with extra args
# ════════════════════════════════════════════════════
test_run_with_args() {
  header "Run - with extra arguments"
  clean_workspace

  # Create a skill with a command that echoes args
  local src="/tmp/test-run-args"
  rm -rf "$src"
  mkdir -p "$src/argskill"

  cat > "$src/argskill/SKILL.md" <<'SKILL'
---
name: argskill
description: Skill that accepts args
version: 1.0.0
commands:
  echo-args:
    run: echo "args:"
    description: Echo with args
---

# Arg Skill
SKILL

  cd "$WORKSPACE" && $CLI add "$src" -a claude-code -y >/dev/null 2>&1 || true

  # Run with extra args (using -- separator)
  local output
  output=$(cd "$WORKSPACE" && $CLI run argskill:echo-args -- foo bar 2>&1) || true

  assert_contains "$output" "args:" "base command executed"
  assert_contains "$output" "foo" "first arg passed"
  assert_contains "$output" "bar" "second arg passed"

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: Run command - with script file
# ════════════════════════════════════════════════════
test_run_script() {
  header "Run - script execution"
  clean_workspace

  # Create a skill with a script
  local src="/tmp/test-run-script"
  rm -rf "$src"
  mkdir -p "$src/scriptskill/scripts"

  cat > "$src/scriptskill/scripts/hello.sh" <<'SCRIPT'
#!/usr/bin/env bash
echo "Script says: $ASKILL_SKILL_NAME"
SCRIPT
  chmod +x "$src/scriptskill/scripts/hello.sh"

  cat > "$src/scriptskill/SKILL.md" <<'SKILL'
---
name: scriptskill
description: Skill with script command
version: 1.0.0
commands:
  hello:
    run: bash scripts/hello.sh
    description: Run the hello script
---

# Script Skill
SKILL

  cd "$WORKSPACE" && $CLI add "$src" -a claude-code -y >/dev/null 2>&1 || true

  local output
  output=$(cd "$WORKSPACE" && $CLI run scriptskill:hello 2>&1) || true

  assert_contains "$output" "Script says: scriptskill" "script receives ASKILL_SKILL_NAME env var"

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: Validate - file not found
# ════════════════════════════════════════════════════
test_validate_not_found() {
  header "Validate - file not found"
  clean_workspace

  local output
  output=$(cd "$WORKSPACE" && $CLI validate nonexistent.md 2>&1) || true

  assert_contains "$output" "not found" "reports file not found"
}

# ════════════════════════════════════════════════════
# Test: Validate - valid SKILL.md
# ════════════════════════════════════════════════════
test_validate_valid() {
  header "Validate - valid SKILL.md"
  clean_workspace

  mkdir -p "$WORKSPACE/test-skill"
  cat > "$WORKSPACE/test-skill/SKILL.md" <<'SKILL'
---
name: test-skill
description: A test skill for validation
version: 1.0.0
author: tester
tags:
  - test
  - validation
---

# Test Skill

This is a test.
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI validate test-skill/SKILL.md 2>&1) || true

  assert_contains "$output" "Ready to publish" "reports valid"
  assert_contains "$output" "name" "checks name field"
  assert_contains "$output" "description" "checks description field"
}

# ════════════════════════════════════════════════════
# Test: Validate - missing required field
# ════════════════════════════════════════════════════
test_validate_missing_field() {
  header "Validate - missing required field"
  clean_workspace

  mkdir -p "$WORKSPACE/bad-skill"
  cat > "$WORKSPACE/bad-skill/SKILL.md" <<'SKILL'
---
name: incomplete
---

# Incomplete Skill
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI validate bad-skill/SKILL.md 2>&1) || true

  assert_contains "$output" "Missing required field" "reports missing field"
  assert_contains "$output" "description" "identifies missing description"
}

# ════════════════════════════════════════════════════
# Test: Validate - invalid version
# ════════════════════════════════════════════════════
test_validate_invalid_version() {
  header "Validate - invalid version format"
  clean_workspace

  mkdir -p "$WORKSPACE/ver-skill"
  cat > "$WORKSPACE/ver-skill/SKILL.md" <<'SKILL'
---
name: verskill
description: A skill with bad version
version: not-a-version
---

# Version Skill
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI validate ver-skill/SKILL.md 2>&1) || true

  assert_contains "$output" "version" "checks version"
  assert_contains "$output" "semver" "mentions semver format"
}

# ════════════════════════════════════════════════════
# Test: Validate - with commands
# ════════════════════════════════════════════════════
test_validate_with_commands() {
  header "Validate - with commands"
  clean_workspace

  mkdir -p "$WORKSPACE/cmd-skill"
  cat > "$WORKSPACE/cmd-skill/SKILL.md" <<'SKILL'
---
name: cmdskill
description: A skill with commands
version: 1.0.0
commands:
  build:
    run: npm run build
    description: Build the project
  test:
    run: npm test
    description: Run tests
---

# Command Skill
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI validate cmd-skill/SKILL.md 2>&1) || true

  assert_contains "$output" "Ready to publish" "valid with commands"
  assert_contains "$output" "Commands: 2" "counts commands"
}

# ════════════════════════════════════════════════════
# Test: Validate - command missing run field
# ════════════════════════════════════════════════════
test_validate_command_missing_run() {
  header "Validate - command missing run"
  clean_workspace

  mkdir -p "$WORKSPACE/badcmd-skill"
  cat > "$WORKSPACE/badcmd-skill/SKILL.md" <<'SKILL'
---
name: badcmd
description: A skill with invalid command
version: 1.0.0
commands:
  broken:
    description: This command has no run field
---

# Bad Command Skill
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI validate badcmd-skill/SKILL.md 2>&1) || true

  assert_contains "$output" "missing" "reports missing field"
  assert_contains "$output" "run" "identifies missing run field"
}

# ════════════════════════════════════════════════════
# Test: Validate - default path (current dir)
# ════════════════════════════════════════════════════
test_validate_default_path() {
  header "Validate - default path (./SKILL.md)"
  clean_workspace

  cat > "$WORKSPACE/SKILL.md" <<'SKILL'
---
name: default-skill
description: Testing default path validation
version: 0.1.0
---

# Default Skill
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI validate 2>&1) || true

  assert_contains "$output" "Ready to publish" "validates default path"
}

# ════════════════════════════════════════════════════
# Test: Validate - no frontmatter
# ════════════════════════════════════════════════════
test_validate_no_frontmatter() {
  header "Validate - no frontmatter"
  clean_workspace

  mkdir -p "$WORKSPACE/nofm-skill"
  cat > "$WORKSPACE/nofm-skill/SKILL.md" <<'SKILL'
# No Frontmatter Skill

This skill has no YAML frontmatter.
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI validate nofm-skill/SKILL.md 2>&1) || true

  assert_contains "$output" "frontmatter" "reports missing frontmatter"
}

# ════════════════════════════════════════════════════
# Test: Upgrade command - checks for updates
# ════════════════════════════════════════════════════
test_upgrade_checks_version() {
  header "Upgrade - checks for updates"

  local output
  output=$($CLI upgrade 2>&1) || true

  # Should check for updates and report status
  if output_matches "$output" "Checking for updates"; then
    pass "upgrade checks for updates"
  else
    fail "upgrade did not check for updates"
    echo "$output" | strip_ansi | head -5 | sed 's/^/    /'
  fi

  # Should report version status (either up to date or new version available)
  if output_matches "$output" "latest version\|Updating from\|Failed to check"; then
    pass "upgrade reports version status"
  else
    fail "upgrade did not report version status"
  fi
}

# ════════════════════════════════════════════════════
# Test: Upgrade command - already up to date
# ════════════════════════════════════════════════════
test_upgrade_already_latest() {
  header "Upgrade - already up to date"

  local output
  output=$($CLI upgrade 2>&1) || true

  # Current version should be latest (since we just built it)
  if output_matches "$output" "already on the latest version\|$(cli_version)"; then
    pass "reports already on latest version"
  elif output_matches "$output" "Failed to check"; then
    fail "could not check version"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  else
    # There might actually be a newer version, which is also OK
    if output_matches "$output" "Updating from"; then
      pass "found newer version to update to"
    else
      fail "unexpected upgrade output"
      echo "$output" | strip_ansi | head -5 | sed 's/^/    /'
    fi
  fi
}

# ════════════════════════════════════════════════════
# Test: Help shows upgrade command
# ════════════════════════════════════════════════════
test_help_shows_upgrade() {
  header "Help shows upgrade command"

  local output
  output=$($CLI --help 2>&1) || true

  assert_contains "$output" "upgrade" "help shows upgrade command"
  assert_contains "$output" "Update askill CLI" "shows upgrade description"
}

# ════════════════════════════════════════════════════
# Test: Remove global skill
# ════════════════════════════════════════════════════
test_remove_global() {
  header "Remove global skill"
  clean_workspace

  # Install globally first
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -g -y >/dev/null 2>&1 || true

  # Verify installed
  if [ ! -e "/root/.claude/skills/discover-a-skill" ]; then
    fail "global skill not installed, cannot test removal"
    return
  fi

  # Remove globally
  local output
  output=$(cd "$WORKSPACE" && $CLI remove discover-a-skill -g --json 2>&1) || true

  # Verify removed
  if [ ! -e "/root/.claude/skills/discover-a-skill" ]; then
    pass "global skill removed"
  else
    fail "global skill still exists after removal"
  fi
}

# ════════════════════════════════════════════════════
# Test: List global only
# ════════════════════════════════════════════════════
test_list_global() {
  header "List global skills only"
  clean_workspace

  # Install one locally and one globally
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -g -y >/dev/null 2>&1 || true

  # List global only
  local output
  output=$(cd "$WORKSPACE" && $CLI list -g 2>&1) || true

  assert_contains "$output" "discover-a-skill" "lists global skill"
  assert_contains "$output" "global" "indicates global scope"
}

# ════════════════════════════════════════════════════
# Test: List --json output structure
# ════════════════════════════════════════════════════
test_list_json_output() {
  header "List --json output"
  clean_workspace

  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  local output
  output=$(cd "$WORKSPACE" && $CLI list --json 2>&1) || true

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (!Array.isArray(data.skills)) process.exit(1);
    const skill = data.skills.find((s) => s.name === "discover-a-skill" && s.scope === "project");
    if (!skill) process.exit(1);
    if (!Array.isArray(skill.agents) || !skill.agents.some((agent) => agent.id === "claude-code")) process.exit(1);
  '; then
    pass "list --json returns expected shape"
  else
    fail "list --json output is invalid"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: List --json scope/agent filters
# ════════════════════════════════════════════════════
test_list_json_filters() {
  header "List --json filters"
  clean_workspace

  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code cursor -y >/dev/null 2>&1 || true
  cd "$WORKSPACE" && $CLI add /app/skills/build-a-skill -a claude-code -g -y >/dev/null 2>&1 || true

  local output
  output=$(cd "$WORKSPACE" && $CLI list -p -a claude-code --json 2>&1) || true

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (!data.filters || data.filters.scope !== "project") process.exit(1);
    if (!Array.isArray(data.filters.agents) || data.filters.agents.length !== 1) process.exit(1);
    if (data.filters.agents[0].id !== "claude-code") process.exit(1);
    if (!Array.isArray(data.skills) || data.skills.length === 0) process.exit(1);
    if (!data.skills.every((skill) => skill.scope === "project")) process.exit(1);
    if (!data.skills.every((skill) => Array.isArray(skill.agents) && skill.agents.every((agent) => agent.id === "claude-code"))) process.exit(1);
  '; then
    pass "list --json applies scope and agent filters"
  else
    fail "list --json filters returned unexpected payload"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: List --json invalid option combination
# ════════════════════════════════════════════════════
test_list_json_invalid_options() {
  header "List --json invalid options"
  clean_workspace

  local output
  output=$(cd "$WORKSPACE" && $CLI list -g -p --json 2>&1) || true

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "INVALID_OPTIONS") process.exit(1);
  '; then
    pass "list --json returns structured option errors"
  else
    fail "list --json invalid option error format mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Remove --json with agent filter
# ════════════════════════════════════════════════════
test_remove_json_agent_filter() {
  header "Remove --json agent filter"
  clean_workspace

  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code cursor -y >/dev/null 2>&1 || true

  local output
  output=$(cd "$WORKSPACE" && $CLI remove discover-a-skill -a cursor --json 2>&1) || true

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (!Array.isArray(data.removedAgents) || data.removedAgents.length !== 1) process.exit(1);
    if (data.removedAgents[0].id !== "cursor") process.exit(1);
    if (!Array.isArray(data.requestedAgents) || data.requestedAgents.length !== 1) process.exit(1);
    if (data.requestedAgents[0].id !== "cursor") process.exit(1);
    if (!Array.isArray(data.failed) || data.failed.length !== 0) process.exit(1);
  '; then
    pass "remove --json reports targeted agent removal"
  else
    fail "remove --json payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  if [ -e "$WORKSPACE/.claude/skills/discover-a-skill" ] && [ ! -e "$WORKSPACE/.cursor/skills/discover-a-skill" ]; then
    pass "agent-scoped remove only affects selected agent"
  else
    fail "agent-scoped remove touched unexpected agent paths"
  fi
}

# ════════════════════════════════════════════════════
# Test: Add --json (preview + install)
# ════════════════════════════════════════════════════
test_add_json_preview_and_install() {
  header "Add --json preview and install"
  clean_workspace

  local src="/tmp/test-json-add"
  rm -rf "$src"
  mkdir -p "$src/alpha" "$src/beta"

  cat > "$src/alpha/SKILL.md" <<'SKILL'
---
name: json-alpha
description: JSON alpha skill
version: 1.0.0
---
# JSON Alpha
SKILL

  cat > "$src/beta/SKILL.md" <<'SKILL'
---
name: json-beta
description: JSON beta skill
version: 1.0.0
---
# JSON Beta
SKILL

  local preview
  preview=$(cd "$WORKSPACE" && $CLI add "$src" --list --json 2>&1) || true
  if echo "$preview" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (data.action !== "preview") process.exit(1);
    if (!Array.isArray(data.skills) || data.skills.length !== 2) process.exit(1);
    const names = data.skills.map((skill) => skill.name).sort();
    if (names[0] !== "json-alpha" || names[1] !== "json-beta") process.exit(1);
  '; then
    pass "add --list --json returns discovered skills"
  else
    fail "add --list --json payload mismatch"
    echo "$preview" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  local install
  install=$(cd "$WORKSPACE" && $CLI add "$src" --all -a claude-code -y --json 2>&1) || true
  if echo "$install" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (data.action !== "install") process.exit(1);
    if (!data.summary || typeof data.summary.successful !== "number") process.exit(1);
    if (!Array.isArray(data.results) || data.results.length < 2) process.exit(1);
    if (!data.results.every((result) => result.success === true)) process.exit(1);
    const names = new Set(data.results.map((result) => result.skill));
    if (!names.has("json-alpha") || !names.has("json-beta")) process.exit(1);
  '; then
    pass "add --json install reports structured success"
  else
    fail "add --json install payload mismatch"
    echo "$install" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  if [ -e "$WORKSPACE/.claude/skills/json-alpha" ] && [ -e "$WORKSPACE/.claude/skills/json-beta" ]; then
    pass "add --json install writes both skills"
  else
    fail "add --json install did not write expected skills"
  fi

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: Add --json invalid agent
# ════════════════════════════════════════════════════
test_add_json_invalid_agent() {
  header "Add --json invalid agent"
  clean_workspace

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a not-a-real-agent -y --json 2>&1) || code=$?

  if [ "$code" -eq 1 ]; then
    pass "add --json returns non-zero on invalid agent"
  else
    fail "add --json should fail on invalid agent (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "INVALID_AGENTS") process.exit(1);
    if (!data.error.details || !Array.isArray(data.error.details.invalidAgents)) process.exit(1);
    if (!data.error.details.invalidAgents.includes("not-a-real-agent")) process.exit(1);
  '; then
    pass "add --json reports invalid agent details"
  else
    fail "add --json invalid agent payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Add --json requires selection for multi-skill source
# ════════════════════════════════════════════════════
test_add_json_requires_selection() {
  header "Add --json requires selection"
  clean_workspace

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI add /app/skills --json 2>&1) || code=$?

  if [ "$code" -eq 1 ]; then
    pass "add --json exits non-zero when selection is required"
  else
    fail "add --json should fail without --all/--yes on multi-skill source (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "MULTIPLE_SKILLS_REQUIRE_SELECTION") process.exit(1);
  '; then
    pass "add --json reports selection requirement"
  else
    fail "add --json selection error payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Add --skill selector for local multi-skill sources
# ════════════════════════════════════════════════════
test_add_skill_selector_local() {
  header "Add --skill selector (local source)"
  clean_workspace

  local src="/tmp/test-skill-selector"
  rm -rf "$src"
  mkdir -p "$src/alpha" "$src/beta"

  cat > "$src/alpha/SKILL.md" <<'SKILL'
---
name: selector-alpha
description: selector alpha skill
version: 1.0.0
---
# Selector Alpha
SKILL

  cat > "$src/beta/SKILL.md" <<'SKILL'
---
name: selector-beta
description: selector beta skill
version: 1.0.0
---
# Selector Beta
SKILL

  local output
  output=$(cd "$WORKSPACE" && $CLI add "$src" --skill selector-beta -a claude-code -y --json 2>&1) || true
  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (!Array.isArray(data.requestedSkills) || data.requestedSkills.length !== 1) process.exit(1);
    if (data.requestedSkills[0].name !== "selector-beta") process.exit(1);
    if (!Array.isArray(data.results) || !data.results.every((result) => result.skill === "selector-beta")) process.exit(1);
  '; then
    pass "add --skill installs selected local skill"
  else
    fail "add --skill local selector payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  if [ -e "$WORKSPACE/.claude/skills/selector-beta" ] && [ ! -e "$WORKSPACE/.claude/skills/selector-alpha" ]; then
    pass "add --skill only writes selected skill"
  else
    fail "add --skill wrote unexpected local skills"
  fi

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: Add --skill selector errors
# ════════════════════════════════════════════════════
test_add_skill_selector_errors() {
  header "Add --skill selector errors"
  clean_workspace

  local src="/tmp/test-skill-selector-errors"
  rm -rf "$src"
  mkdir -p "$src/alpha"

  cat > "$src/alpha/SKILL.md" <<'SKILL'
---
name: selector-error-alpha
description: selector error alpha skill
version: 1.0.0
---
# Selector Error Alpha
SKILL

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI add "$src" --skill -y --json 2>&1) || code=$?
  if [ "$code" -eq 1 ]; then
    pass "add --skill without value exits non-zero"
  else
    fail "add --skill without value should fail (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "MISSING_SKILL_OPTION_VALUE") process.exit(1);
  '; then
    pass "add --skill without value reports structured error"
  else
    fail "add --skill without value payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  code=0
  output=$(cd "$WORKSPACE" && $CLI add "$src" --skill does-not-exist -a claude-code -y --json 2>&1) || code=$?
  if [ "$code" -eq 1 ]; then
    pass "add --skill no match exits non-zero"
  else
    fail "add --skill no match should fail (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "SKILL_NOT_FOUND") process.exit(1);
    if (!data.error.details || data.error.details.requestedSkill !== "does-not-exist") process.exit(1);
  '; then
    pass "add --skill no match reports structured error"
  else
    fail "add --skill no match payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  if [ ! -e "$WORKSPACE/.claude/skills/selector-error-alpha" ]; then
    pass "add --skill no match installs nothing"
  else
    fail "add --skill no match unexpectedly installed a skill"
  fi

  rm -rf "$src"
}

# ════════════════════════════════════════════════════
# Test: Add --skill selector misses in collections
# ════════════════════════════════════════════════════
test_add_skill_selector_collection_no_match() {
  header "Add --skill selector no match (collection)"
  clean_workspace

  start_mock_registry || return

  local registry_url="http://127.0.0.1:${MOCK_REGISTRY_PORT}"
  local api_url="${registry_url}/api/v1"
  local output
  local code=0

  output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI add col:mock/dev-tools--grp123 --skill does-not-exist -a claude-code -y --json 2>&1) || code=$?
  if [ "$code" -eq 1 ]; then
    pass "collection --skill no match exits non-zero"
  else
    fail "collection --skill no match should fail (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "SKILL_NOT_FOUND") process.exit(1);
    if (!data.error.details || data.error.details.requestedSkill !== "does-not-exist") process.exit(1);
  '; then
    pass "collection --skill no match reports selector error"
  else
    fail "collection --skill no match payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  stop_mock_registry
}

# ════════════════════════════════════════════════════
# Test: Add --skill selector miss cleans cloned git temp dirs
# ════════════════════════════════════════════════════
test_add_skill_selector_git_miss_cleans_temp() {
  header "Add --skill selector cleans git temp"
  clean_workspace

  local repo="/tmp/test-skill-selector-git-miss"
  rm -rf "$repo"
  mkdir -p "$repo/skills/alpha"

  cat > "$repo/skills/alpha/SKILL.md" <<'SKILL'
---
name: selector-git-alpha
description: selector git alpha skill
version: 1.0.0
---
# Selector Git Alpha
SKILL

  git -C "$repo" init >/dev/null 2>&1
  git -C "$repo" add . >/dev/null 2>&1
  git -C "$repo" -c user.email=e2e@example.com -c user.name=E2E commit -m init >/dev/null 2>&1

  local before_count
  before_count=$(ls -d /tmp/askill-* 2>/dev/null | wc -l | tr -d ' ')

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI add "file://$repo" --skill does-not-exist -a claude-code -y --json 2>&1) || code=$?
  if [ "$code" -eq 1 ]; then
    pass "git --skill no match exits non-zero"
  else
    fail "git --skill no match should fail (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "SKILL_NOT_FOUND") process.exit(1);
  '; then
    pass "git --skill no match reports selector error"
  else
    fail "git --skill no match payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  local after_count
  after_count=$(ls -d /tmp/askill-* 2>/dev/null | wc -l | tr -d ' ')
  if [ "$after_count" = "$before_count" ]; then
    pass "git --skill no match cleans cloned temp dir"
  else
    fail "git --skill no match leaked temp dir (before=$before_count after=$after_count)"
  fi

  rm -rf "$repo"
}

# ════════════════════════════════════════════════════
# Test: Add --skill selector for registry refs inside collections
# ════════════════════════════════════════════════════
test_add_skill_selector_collection_registry_refs() {
  header "Add --skill selector (collection registry refs)"
  clean_workspace

  start_mock_registry || return

  local registry_url="http://127.0.0.1:${MOCK_REGISTRY_PORT}"
  local api_url="${registry_url}/api/v1"

  local output
  output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI add col:mock/dev-tools--grp123 --skill beta-collection-skill -a claude-code -y --json 2>&1) || true
  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (!Array.isArray(data.requestedSkills) || data.requestedSkills.length !== 1) process.exit(1);
    if (data.requestedSkills[0].name !== "beta-collection-skill") process.exit(1);
    if (!Array.isArray(data.results) || data.results.length !== 1) process.exit(1);
    if (!data.results.every((result) => result.skill === "beta-collection-skill" && result.success === true)) process.exit(1);
  '; then
    pass "add --skill filters registry-backed collection refs"
  else
    fail "add --skill collection selector payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  if [ -e "$WORKSPACE/.claude/skills/beta-collection-skill" ] && [ ! -e "$WORKSPACE/.claude/skills/alpha-collection-skill" ]; then
    pass "add --skill only installs selected collection skill"
  else
    fail "add --skill installed unexpected collection skills"
  fi

  if [ -f "$PROJECT_LOCK" ]; then
    local lock
    lock=$(cat "$PROJECT_LOCK")
    assert_contains "$lock" '"@mock/beta"' "lock records selected collection registry source"
    assert_not_contains "$lock" '"@mock/alpha"' "lock excludes unselected collection registry source"
  else
    fail "lock file missing after selected collection install"
  fi

  stop_mock_registry
}

# ════════════════════════════════════════════════════
# Test: Re-link canonical installed skill to another agent
# ════════════════════════════════════════════════════
test_add_canonical_path_relinks_agent() {
  header "Add canonical path re-links agent"
  clean_workspace

  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  local canonical_path="$WORKSPACE/.agents/skills/discover-a-skill"
  local lock_before
  lock_before=$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(JSON.stringify(data.skills['discover-a-skill']));" "$PROJECT_LOCK")

  local output
  output=$(cd "$WORKSPACE" && $CLI add "$canonical_path" -a cursor -y --json 2>&1) || true
  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (!Array.isArray(data.results) || data.results.length !== 1) process.exit(1);
    const result = data.results[0];
    if (result.skill !== "discover-a-skill" || result.agent.id !== "cursor" || result.success !== true) process.exit(1);
  '; then
    pass "canonical path add reports relink success"
  else
    fail "canonical path relink payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  if [ -f "$canonical_path/SKILL.md" ] && [ -e "$WORKSPACE/.claude/skills/discover-a-skill" ] && [ -e "$WORKSPACE/.cursor/skills/discover-a-skill" ]; then
    pass "canonical path relink preserves source and links new agent"
  else
    fail "canonical path relink did not preserve expected paths"
  fi

  local lock_after
  lock_after=$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); process.stdout.write(JSON.stringify(data.skills['discover-a-skill']));" "$PROJECT_LOCK")
  if [ "$lock_before" = "$lock_after" ]; then
    pass "canonical path relink preserves existing lock metadata"
  else
    fail "canonical path relink changed existing lock metadata"
  fi
}

# ════════════════════════════════════════════════════
# Test: Registry checks/updates in interactive CLI mode
# ════════════════════════════════════════════════════
test_registry_interactive_check_update() {
  header "Registry interactive check/update"
  clean_workspace

  start_mock_registry || return

  local registry_url="http://127.0.0.1:${MOCK_REGISTRY_PORT}"
  local api_url="${registry_url}/api/v1"

  cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI add @mock/beta -a claude-code -y >/dev/null 2>&1 || true
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const content = fs.readFileSync(path, "utf8");
    fs.writeFileSync(path, content.replace("version: 1.0.0", "version: 1.0.0-alpha.1"));
  ' "$WORKSPACE/.agents/skills/beta-collection-skill/SKILL.md"

  local check_output
  check_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI check 2>&1) || true
  assert_contains "$check_output" "1 skill(s) have updates available" "interactive check detects registry version update"
  assert_contains "$check_output" "beta-collection-skill" "interactive check names registry skill"
  assert_contains "$check_output" "1.0.0-alpha.1 → 1.0.0" "interactive check compares prerelease below stable"

  local update_output
  update_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI update -y 2>&1) || true
  assert_contains "$update_output" "Updated 1 skill(s)" "interactive update refreshes registry skill"

  local updated_version
  updated_version=$(node -e '
    const fs = require("fs");
    const content = fs.readFileSync(process.argv[1], "utf8");
    const match = content.match(/^version:\s*(.+)$/m);
    process.stdout.write(match ? match[1].trim() : "");
  ' "$WORKSPACE/.agents/skills/beta-collection-skill/SKILL.md")
  if [ "$updated_version" = "1.0.0" ]; then
    pass "interactive update writes latest registry SKILL.md"
  else
    fail "interactive update did not refresh registry skill version"
  fi

  stop_mock_registry
}

# ════════════════════════════════════════════════════
# Test: Registry copy-mode check/update
# ════════════════════════════════════════════════════
test_registry_copy_mode_check_update() {
  header "Registry copy-mode check/update"
  clean_workspace

  start_mock_registry || return

  local registry_url="http://127.0.0.1:${MOCK_REGISTRY_PORT}"
  local api_url="${registry_url}/api/v1"

  cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI add @mock/alpha -a claude-code --copy -y --json >/dev/null 2>&1 || true
  if [ ! -e "$WORKSPACE/.agents/skills/alpha-collection-skill" ] && [ -f "$WORKSPACE/.claude/skills/alpha-collection-skill/SKILL.md" ]; then
    pass "copy-mode registry install only writes agent directory"
  else
    fail "copy-mode registry install did not create expected layout"
  fi

  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const content = fs.readFileSync(path, "utf8");
    fs.writeFileSync(path, content.replace("version: 1.0.0", "version: 1.0.0-alpha.1"));
  ' "$WORKSPACE/.claude/skills/alpha-collection-skill/SKILL.md"

  local check_output
  check_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI check --json 2>&1) || true
  if echo "$check_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const target = (data.skills || []).find((skill) => skill.name === "alpha-collection-skill");
    if (!target || target.status !== "update_available") process.exit(1);
    if (target.localVersion !== "1.0.0-alpha.1" || target.remoteVersion !== "1.0.0") process.exit(1);
  '; then
    pass "check --json reads copy-mode registry version from agent dir"
  else
    fail "copy-mode registry check payload mismatch"
    echo "$check_output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  local update_output
  update_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI update --json 2>&1) || true
  if echo "$update_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const target = (data.results || []).find((result) => result.skill === "alpha-collection-skill");
    if (!target || target.status !== "updated") process.exit(1);
  '; then
    pass "update --json updates copy-mode registry install"
  else
    fail "copy-mode registry update payload mismatch"
    echo "$update_output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  local updated_version
  updated_version=$(node -e '
    const fs = require("fs");
    const content = fs.readFileSync(process.argv[1], "utf8");
    const match = content.match(/^version:\s*(.+)$/m);
    process.stdout.write(match ? match[1].trim() : "");
  ' "$WORKSPACE/.claude/skills/alpha-collection-skill/SKILL.md")
  if [ "$updated_version" = "1.0.0" ]; then
    pass "copy-mode registry update writes latest SKILL.md"
  else
    fail "copy-mode registry update did not refresh version"
  fi

  if [ ! -e "$WORKSPACE/.agents/skills/alpha-collection-skill" ] && [ ! -L "$WORKSPACE/.claude/skills/alpha-collection-skill" ]; then
    pass "copy-mode registry update preserves copy layout"
  else
    fail "copy-mode registry update converted install to symlink layout"
  fi

  stop_mock_registry
}

# ════════════════════════════════════════════════════
# Test: Registry version pins use range-aware candidates
# ════════════════════════════════════════════════════
test_registry_version_pin_uses_range_update() {
  header "Registry version pin uses range update"
  clean_workspace

  start_mock_registry || return

  local registry_url="http://127.0.0.1:${MOCK_REGISTRY_PORT}"
  local api_url="${registry_url}/api/v1"

  cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI add @mock/alpha@^1.0.0 -a claude-code -y --json >/dev/null 2>&1 || true
  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const content = fs.readFileSync(path, "utf8");
    fs.writeFileSync(path, content.replace("version: 1.1.0", "version: 1.0.0"));
  ' "$WORKSPACE/.agents/skills/alpha-collection-skill/SKILL.md"
  printf '2.0.0' > /tmp/askill-mock-mock-alpha-version

  local check_output
  check_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI check --json 2>&1) || true
  if echo "$check_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (!data.summary || data.summary.updateAvailable !== 1 || data.summary.upToDate !== 0) process.exit(1);
    const target = (data.skills || []).find((skill) => skill.name === "alpha-collection-skill");
    if (!target || target.status !== "update_available") process.exit(1);
    if (target.localVersion !== "1.0.0" || target.remoteVersion !== "1.1.0") process.exit(1);
  '; then
    pass "check --json uses registry range-aware update candidate"
  else
    fail "registry version pin check payload mismatch"
    echo "$check_output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  local update_output
  update_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI update --json 2>&1) || true
  if echo "$update_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (!data.summary || data.summary.updated !== 1 || data.summary.skipped !== 0) process.exit(1);
    const target = (data.results || []).find((result) => result.skill === "alpha-collection-skill");
    if (!target || target.status !== "updated" || target.checkStatus !== "update_available") process.exit(1);
    if (target.remoteVersion !== "1.1.0") process.exit(1);
  '; then
    pass "update --json installs registry range-aware update candidate"
  else
    fail "registry version pin update payload mismatch"
    echo "$update_output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  local updated_version
  updated_version=$(node -e '
    const fs = require("fs");
    const content = fs.readFileSync(process.argv[1], "utf8");
    const match = content.match(/^version:\s*(.+)$/m);
    process.stdout.write(match ? match[1].trim() : "");
  ' "$WORKSPACE/.agents/skills/alpha-collection-skill/SKILL.md")
  if [ "$updated_version" = "1.1.0" ]; then
    pass "registry range update writes matching version"
  else
    fail "registry range update wrote unexpected version"
  fi

  stop_mock_registry
}

# ════════════════════════════════════════════════════
# Test: Registry updates stay on locked skill name
# ════════════════════════════════════════════════════
test_registry_update_keeps_locked_skill_name() {
  header "Registry update keeps locked skill name"
  clean_workspace

  start_mock_registry || return

  local registry_url="http://127.0.0.1:${MOCK_REGISTRY_PORT}"
  local api_url="${registry_url}/api/v1"

  cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI add @mock/alpha -a claude-code -y --json >/dev/null 2>&1 || true
  node -e '
    const fs = require("fs");
    const lockPath = process.argv[1];
    const data = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    data.skills["alpha-collection-skill"].source = "@mock/renamed";
    data.skills["alpha-collection-skill"].sourceUrl = "@mock/renamed";
    fs.writeFileSync(lockPath, JSON.stringify(data, null, 2));
  ' "$PROJECT_LOCK"

  local update_output
  update_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI update --json 2>&1) || true
  if echo "$update_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const target = (data.results || []).find((result) => result.skill === "alpha-collection-skill");
    if (!target || target.status !== "updated") process.exit(1);
  '; then
    pass "update --json updates renamed registry source"
  else
    fail "renamed registry update payload mismatch"
    echo "$update_output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  if [ -f "$WORKSPACE/.agents/skills/alpha-collection-skill/SKILL.md" ] && [ ! -e "$WORKSPACE/.agents/skills/renamed-remote-skill" ]; then
    pass "registry update keeps locked install directory"
  else
    fail "registry update wrote renamed install directory"
  fi

  local check_output
  check_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI check --json 2>&1) || true
  if echo "$check_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const target = (data.skills || []).find((skill) => skill.name === "alpha-collection-skill");
    if (!target || target.status !== "up_to_date") process.exit(1);
    if (target.localVersion !== "1.1.0" || target.remoteVersion !== "1.1.0") process.exit(1);
  '; then
    pass "registry renamed update converges on next check"
  else
    fail "renamed registry follow-up check mismatch"
    echo "$check_output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  stop_mock_registry
}

# ════════════════════════════════════════════════════
# Test: List --json invalid agent
# ════════════════════════════════════════════════════
test_list_json_invalid_agent() {
  header "List --json invalid agent"
  clean_workspace

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI list -a not-a-real-agent --json 2>&1) || code=$?

  if [ "$code" -eq 1 ]; then
    pass "list --json returns non-zero on invalid agent"
  else
    fail "list --json should fail on invalid agent (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "INVALID_AGENTS") process.exit(1);
    if (!data.error.details || !Array.isArray(data.error.details.invalidAgents)) process.exit(1);
    if (!data.error.details.invalidAgents.includes("not-a-real-agent")) process.exit(1);
  '; then
    pass "list --json reports invalid agent details"
  else
    fail "list --json invalid agent payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Remove --json missing skill argument
# ════════════════════════════════════════════════════
test_remove_json_missing_skill() {
  header "Remove --json missing skill"
  clean_workspace

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI remove --json 2>&1) || code=$?

  if [ "$code" -eq 1 ]; then
    pass "remove --json returns non-zero when skill is missing"
  else
    fail "remove --json should fail without skill name (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "MISSING_SKILL") process.exit(1);
  '; then
    pass "remove --json reports missing skill error"
  else
    fail "remove --json missing skill payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Remove --json invalid agent
# ════════════════════════════════════════════════════
test_remove_json_invalid_agent() {
  header "Remove --json invalid agent"
  clean_workspace

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI remove discover-a-skill -a not-a-real-agent --json 2>&1) || code=$?

  if [ "$code" -eq 1 ]; then
    pass "remove --json returns non-zero on invalid agent"
  else
    fail "remove --json should fail on invalid agent (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (!data.error || data.error.code !== "INVALID_AGENTS") process.exit(1);
    if (!data.error.details || !Array.isArray(data.error.details.invalidAgents)) process.exit(1);
    if (!data.error.details.invalidAgents.includes("not-a-real-agent")) process.exit(1);
  '; then
    pass "remove --json reports invalid agent details"
  else
    fail "remove --json invalid agent payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Remove not found suggests --global when applicable
# ════════════════════════════════════════════════════
test_remove_suggests_global_scope() {
  header "Remove suggests --global"
  clean_workspace

  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -g -y >/dev/null 2>&1 || true

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI remove discover-a-skill 2>&1) || code=$?

  if [ "$code" -eq 1 ]; then
    pass "remove exits non-zero when project skill is missing"
  else
    fail "remove should fail when skill is only installed globally (exit=$code)"
  fi

  assert_contains "$output" "Skill \"discover-a-skill\" not found" "remove reports not found in current scope"
  assert_contains "$output" "Use --global (-g) to remove it" "remove suggests global scope flag"
}

# ════════════════════════════════════════════════════
# Test: Remove --json not found payload semantics
# ════════════════════════════════════════════════════
test_remove_json_not_found_semantics() {
  header "Remove --json not found semantics"
  clean_workspace

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI remove not-installed-skill --json 2>&1) || code=$?

  if [ "$code" -eq 1 ]; then
    pass "remove --json returns non-zero when skill is not installed"
  else
    fail "remove --json should fail when skill is not installed (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (data.skill !== "not-installed-skill") process.exit(1);
    if (!Array.isArray(data.failed) || data.failed.length !== 1) process.exit(1);
    if (!data.failed[0] || typeof data.failed[0].error !== "string") process.exit(1);
    if (!data.failed[0].error.includes("not found")) process.exit(1);
    if (typeof data.message !== "string" || !data.message.includes("not found")) process.exit(1);
  '; then
    pass "remove --json reports not found as structured failure"
  else
    fail "remove --json not found payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Remove --json suggests global scope when needed
# ════════════════════════════════════════════════════
test_remove_json_suggests_global_scope() {
  header "Remove --json suggests --global"
  clean_workspace

  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -g -y >/dev/null 2>&1 || true

  local output
  local code=0
  output=$(cd "$WORKSPACE" && $CLI remove discover-a-skill --json 2>&1) || code=$?

  if [ "$code" -eq 1 ]; then
    pass "remove --json exits non-zero when only global install exists"
  else
    fail "remove --json should fail without -g for global-only install (exit=$code)"
  fi

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== false) process.exit(1);
    if (data.scope !== "project") process.exit(1);
    if (!Array.isArray(data.failed) || data.failed.length !== 1) process.exit(1);
    if (typeof data.message !== "string" || !data.message.includes("Use --global (-g)")) process.exit(1);
    if (typeof data.hint !== "string" || !data.hint.includes("Use --global (-g)")) process.exit(1);
  '; then
    pass "remove --json includes global scope hint"
  else
    fail "remove --json global hint payload mismatch"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Find --json machine-readable output
# ════════════════════════════════════════════════════
test_find_json_output() {
  header "Find --json output"

  local output
  output=$($CLI find memory --json 2>&1) || true

  if echo "$output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (typeof data.ok !== "boolean") process.exit(1);

    if (data.ok) {
      if (data.query !== "memory") process.exit(1);
      if (!Array.isArray(data.skills)) process.exit(1);
      if (typeof data.count !== "number") process.exit(1);
      if (data.count !== data.skills.length) process.exit(1);
      if (data.skills.length > 0) {
        const first = data.skills[0];
        if (typeof first.name !== "string") process.exit(1);
        if (!Array.isArray(first.tags)) process.exit(1);
      }
    } else {
      if (!data.error || typeof data.error.code !== "string") process.exit(1);
      if (typeof data.error.message !== "string") process.exit(1);
    }
  '; then
    pass "find --json always returns machine-readable payload"
  else
    fail "find --json payload is not parseable/valid"
    echo "$output" | strip_ansi | head -10 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: Dashboard JSON contracts (mock registry)
# ════════════════════════════════════════════════════
test_dashboard_json_contracts() {
  header "Dashboard JSON contracts"
  clean_workspace

  start_mock_registry || return

  local registry_url="http://127.0.0.1:${MOCK_REGISTRY_PORT}"
  local api_url="${registry_url}/api/v1"

  local find_output
  find_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI find --tag collection --limit 1 --page 1 --json 2>&1) || true
  if echo "$find_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (!data.filters || data.filters.tag !== "collection") process.exit(1);
    if (!data.pagination || data.pagination.page !== 1 || data.pagination.limit !== 1) process.exit(1);
    if (data.count !== 1 || !Array.isArray(data.skills) || data.skills.length !== 1) process.exit(1);
    if (!data.skills[0].tags.includes("collection")) process.exit(1);
  '; then
    pass "find --json supports tag and pagination filters"
  else
    fail "find --json tag/pagination payload mismatch"
    echo "$find_output" | strip_ansi | head -10 | sed 's/^/    /'
    stop_mock_registry
    return
  fi

  local info_output
  info_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI info @mock/alpha --json 2>&1) || true
  if echo "$info_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true) process.exit(1);
    if (!data.skill || data.skill.name !== "alpha-collection-skill") process.exit(1);
    if (data.skill.version !== "1.0.0") process.exit(1);
    if (!data.skill.frontmatter || data.skill.frontmatter.name !== "alpha-collection-skill") process.exit(1);
    if (!data.skill.commands || typeof data.skill.commands !== "object") process.exit(1);
    if (!data.installed || data.installed.installed !== false) process.exit(1);
    if (data.skill.installSource !== "gh:mock/skills@alpha-collection-skill") process.exit(1);
  '; then
    pass "info --json returns registry metadata and frontmatter"
  else
    fail "info --json payload mismatch"
    echo "$info_output" | strip_ansi | head -10 | sed 's/^/    /'
    stop_mock_registry
    return
  fi

  cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI add @mock/alpha -a claude-code -y --json >/dev/null 2>&1 || true

  local list_output
  list_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI list --json 2>&1) || true
  if echo "$list_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    const target = (data.skills || []).find((skill) => skill.name === "alpha-collection-skill");
    if (!target) process.exit(1);
    if (target.description !== "Alpha skill from shared collection") process.exit(1);
    if (target.version !== "1.0.0") process.exit(1);
    if (target.installSource !== "@mock/alpha") process.exit(1);
    if (!target.source || target.source.type !== "registry") process.exit(1);
    if (typeof target.updatedAt !== "string") process.exit(1);
  '; then
    pass "list --json includes dashboard metadata"
  else
    fail "list --json dashboard metadata mismatch"
    echo "$list_output" | strip_ansi | head -10 | sed 's/^/    /'
    stop_mock_registry
    return
  fi

  node -e '
    const fs = require("fs");
    const path = process.argv[1];
    const content = fs.readFileSync(path, "utf8");
    fs.writeFileSync(path, content.replace("version: 1.0.0", "version: 1.0.0-alpha.1"));
  ' "$WORKSPACE/.agents/skills/alpha-collection-skill/SKILL.md"

  local check_output
  check_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI check --json 2>&1) || true
  if echo "$check_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true || data.scope !== "project") process.exit(1);
    if (!data.summary || data.summary.total !== 1 || data.summary.updateAvailable !== 1) process.exit(1);
    const target = (data.skills || []).find((skill) => skill.name === "alpha-collection-skill");
    if (!target || target.status !== "update_available") process.exit(1);
    if (target.sourceType !== "registry") process.exit(1);
    if (target.localVersion !== "1.0.0-alpha.1" || target.remoteVersion !== "1.0.0") process.exit(1);
  '; then
    pass "check --json detects registry version updates"
  else
    fail "check --json payload mismatch"
    echo "$check_output" | strip_ansi | head -10 | sed 's/^/    /'
    stop_mock_registry
    return
  fi

  local update_output
  update_output=$(cd "$WORKSPACE" && ASKILL_REGISTRY_URL="$registry_url" ASKILL_API_BASE_URL="$api_url" $CLI update --json 2>&1) || true
  if echo "$update_output" | node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(0, "utf8"));
    if (data.ok !== true || data.action !== "update") process.exit(1);
    if (!data.summary || data.summary.checked !== 1 || data.summary.updated !== 1) process.exit(1);
    const target = (data.results || []).find((result) => result.skill === "alpha-collection-skill");
    if (!target || target.status !== "updated" || target.checkStatus !== "update_available") process.exit(1);
    if (target.localVersion !== "1.0.0-alpha.1" || target.remoteVersion !== "1.0.0") process.exit(1);
  '; then
    pass "update --json updates registry-sourced skills"
  else
    fail "update --json payload mismatch"
    echo "$update_output" | strip_ansi | head -10 | sed 's/^/    /'
  fi

  local updated_version
  updated_version=$(node -e '
    const fs = require("fs");
    const content = fs.readFileSync(process.argv[1], "utf8");
    const match = content.match(/^version:\s*(.+)$/m);
    process.stdout.write(match ? match[1].trim() : "");
  ' "$WORKSPACE/.agents/skills/alpha-collection-skill/SKILL.md")
  if [ "$updated_version" = "1.0.0" ]; then
    pass "update --json writes latest registry SKILL.md"
  else
    fail "update --json did not refresh registry skill version"
  fi

  stop_mock_registry
}

# ════════════════════════════════════════════════════
# Test: Re-install same skill (should update/overwrite)
# ════════════════════════════════════════════════════
test_reinstall_skill() {
  header "Re-install same skill"
  clean_workspace

  # Install first time
  cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y >/dev/null 2>&1 || true

  # Get modification time
  local first_time
  first_time=$(stat -c %Y "$WORKSPACE/.agents/skills/discover-a-skill/SKILL.md" 2>/dev/null || stat -f %m "$WORKSPACE/.agents/skills/discover-a-skill/SKILL.md" 2>/dev/null)

  # Small delay
  sleep 1

  # Install again
  local output
  output=$(cd "$WORKSPACE" && $CLI add /app/skills/discover-a-skill -a claude-code -y 2>&1) || true

  # Should succeed without error
  if output_matches "$output" "error\|failed"; then
    fail "reinstall failed with error"
  else
    pass "reinstall completed without error"
  fi
}

# ════════════════════════════════════════════════════
# Test: Command aliases
# ════════════════════════════════════════════════════
test_command_aliases() {
  header "Command aliases"
  clean_workspace

  # Test 'i' as alias for 'install/add'
  local output
  output=$(cd "$WORKSPACE" && $CLI i /app/skills/discover-a-skill -a claude-code -y 2>&1) || true
  assert_contains "$output" "discover-a-skill" "alias 'i' works for add"

  # Test 'ls' as alias for 'list'
  output=$(cd "$WORKSPACE" && $CLI ls 2>&1) || true
  if output_matches "$output" "skill\|Installed\|discover-a-skill"; then
    pass "alias 'ls' works for list"
  else
    fail "alias 'ls' failed"
  fi

  # Test 'rm' as alias for 'remove'
  output=$(cd "$WORKSPACE" && $CLI rm discover-a-skill --json 2>&1) || true
  if [ ! -e "$WORKSPACE/.claude/skills/discover-a-skill" ]; then
    pass "alias 'rm' works for remove"
  else
    fail "alias 'rm' failed"
  fi

  # Test 's' as alias for 'search'
  output=$($CLI s memory 2>&1) || true
  if output_matches "$output" "result\|found\|memory\|Search\|error"; then
    pass "alias 's' works for search"
  else
    fail "alias 's' failed"
  fi
}

# ════════════════════════════════════════════════════
# Test: Version flag variants
# ════════════════════════════════════════════════════
test_version_flags() {
  header "Version flag variants"

  local output
  output=$($CLI --version 2>&1) || true
  assert_contains "$output" "$(cli_version)" "--version shows version"

  output=$($CLI -v 2>&1) || true
  assert_contains "$output" "$(cli_version)" "-v shows version"
}

# ════════════════════════════════════════════════════
# Test: Help flag variants
# ════════════════════════════════════════════════════
test_help_flags() {
  header "Help flag variants"

  local output
  output=$($CLI --help 2>&1) || true
  assert_contains "$output" "Usage" "--help shows usage"

  output=$($CLI -h 2>&1) || true
  assert_contains "$output" "Usage" "-h shows usage"
}

# ════════════════════════════════════════════════════
# Runner
# ════════════════════════════════════════════════════

ALL_TESTS=(
  test_banner
  test_help
  test_submit_invalid_url
  test_login_invalid_token
  test_whoami_not_logged_in
  test_logout_clears_credentials
  test_publish_requires_login
  test_publish_local_validation
  test_publish_github_url_validation
  test_version
  test_unknown_command
  test_add_missing_name
  test_list_empty
  test_install_local
  test_install_then_list
  test_install_then_remove
  test_install_multi_agent
  test_install_global
  test_install_copy_mode
  test_install_multi_skill_dir
  test_symlink_mode
  test_config_persistence
  test_lock_file_install
  test_lock_file_remove
  test_lock_file_version
  test_lock_file_scope_isolation
  test_lock_file_legacy_migration
  test_help_includes_check
  test_check_empty
  test_check_local_source
  test_update_noop
  test_update_empty
  test_source_parser
  test_help_collection_sources
  test_install_collection_source
  test_install_collection_url_source
  test_install_collection_production
  test_install_published_slug
  test_install_git_clone
  test_check_after_git_install
  test_init
  test_init_already_exists
  test_list_option
  test_all_option
  test_help_new_options
  test_run_missing_target
  test_run_invalid_format
  test_run_skill_not_found
  test_run_no_commands
  test_run_execute
  test_run_command_not_found
  test_run_with_args
  test_run_script
  test_validate_not_found
  test_validate_valid
  test_validate_missing_field
  test_validate_invalid_version
  test_validate_with_commands
  test_validate_command_missing_run
  test_validate_default_path
  test_validate_no_frontmatter
  test_upgrade_checks_version
  test_upgrade_already_latest
  test_help_shows_upgrade
  test_remove_global
  test_list_global
  test_list_json_output
  test_list_json_filters
  test_list_json_invalid_options
  test_list_json_invalid_agent
  test_remove_json_agent_filter
  test_remove_json_missing_skill
  test_remove_json_invalid_agent
  test_remove_suggests_global_scope
  test_remove_json_not_found_semantics
  test_remove_json_suggests_global_scope
  test_add_json_preview_and_install
  test_add_json_invalid_agent
  test_add_json_requires_selection
  test_add_skill_selector_local
  test_add_skill_selector_errors
  test_add_skill_selector_collection_no_match
  test_add_skill_selector_git_miss_cleans_temp
  test_add_skill_selector_collection_registry_refs
  test_add_canonical_path_relinks_agent
  test_registry_interactive_check_update
  test_registry_copy_mode_check_update
  test_registry_version_pin_uses_range_update
  test_registry_update_keeps_locked_skill_name
  test_find_json_output
  test_dashboard_json_contracts
  test_reinstall_skill
  test_command_aliases
  test_version_flags
  test_help_flags
  test_search
  test_info
  test_product_lifecycle_cli_only
)

# List mode
if [ "${1:-}" = "--list" ]; then
  echo "Available tests:"
  for t in "${ALL_TESTS[@]}"; do echo "  $t"; done
  exit 0
fi

echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║     askill CLI - E2E Integration Tests   ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"

# Run specific test or all
if [ $# -gt 0 ] && [ "$1" != "--list" ]; then
  for t in "$@"; do
    if declare -f "$t" > /dev/null 2>&1; then
      "$t"
    else
      echo -e "${RED}Unknown test: $t${RESET}"
      echo "Run with --list to see available tests"
      exit 1
    fi
  done
else
  for t in "${ALL_TESTS[@]}"; do
    "$t"
  done
fi

# ── Summary ─────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━ Summary ━━━${RESET}"
echo -e "  ${GREEN}Passed:  $PASSED${RESET}"
echo -e "  ${RED}Failed:  $FAILED${RESET}"
echo -e "  ${YELLOW}Skipped: $SKIPPED${RESET}"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo ""
  echo -e "${RED}Failures:${RESET}"
  for e in "${ERRORS[@]}"; do
    echo -e "  ${RED}✗ $e${RESET}"
  done
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}All tests passed!${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}$FAILED test(s) failed${RESET}"
  exit 1
fi
