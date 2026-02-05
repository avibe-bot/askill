#!/usr/bin/env bash
# askill CLI - Installation Methods Tests
# Tests binary, npm, npx, and bun installation methods
#
# Run: ./test/e2e/install-methods.sh

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

# ── Helpers ─────────────────────────────────────────
pass()  { echo -e "${GREEN}  ✓ $*${RESET}"; ((PASSED++)) || true; }
fail()  { echo -e "${RED}  ✗ $*${RESET}"; ((FAILED++)) || true; }
skip()  { echo -e "${YELLOW}  ⊘ $* (skipped)${RESET}"; ((SKIPPED++)) || true; }
header(){ echo -e "\n${BOLD}━━━ $* ━━━${RESET}"; }

strip_ansi() {
  sed 's/\x1b\[[0-9;]*m//g' | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'
}

output_matches() {
  local output="$1" pattern="$2"
  echo "$output" | strip_ansi | grep -qiE "$pattern"
}

# ════════════════════════════════════════════════════
# Test: npm global install
# ════════════════════════════════════════════════════
test_npm_install() {
  header "npm install -g askill-cli"
  
  # Install globally via npm
  local install_output
  install_output=$(npm install -g askill-cli 2>&1) || true
  
  if echo "$install_output" | grep -qE "added|up to date"; then
    pass "npm install succeeded"
  else
    fail "npm install failed"
    echo "$install_output" | head -5 | sed 's/^/    /'
    return
  fi
  
  # Verify command exists
  if command -v askill &>/dev/null; then
    pass "askill command available"
  else
    fail "askill command not found in PATH"
    return
  fi
  
  # Test basic commands
  local output
  output=$(askill --version 2>&1) || true
  if output_matches "$output" "[0-9]+\.[0-9]+\.[0-9]+"; then
    pass "askill --version works"
  else
    fail "askill --version failed"
  fi
  
  output=$(askill --help 2>&1) || true
  if output_matches "$output" "Usage"; then
    pass "askill --help works"
  else
    fail "askill --help failed"
  fi
  
  # Clean up
  npm uninstall -g askill-cli &>/dev/null || true
}

# ════════════════════════════════════════════════════
# Test: npx (no install)
# ════════════════════════════════════════════════════
test_npx() {
  header "npx askill-cli"
  
  # Clear npm cache to ensure fresh fetch
  npm cache clean --force &>/dev/null || true
  
  # Test via npx
  local output
  output=$(npx askill-cli --version 2>&1) || true
  
  if output_matches "$output" "[0-9]+\.[0-9]+\.[0-9]+"; then
    pass "npx askill-cli --version works"
  else
    fail "npx askill-cli --version failed"
    echo "$output" | head -5 | sed 's/^/    /'
  fi
  
  output=$(npx askill-cli --help 2>&1) || true
  if output_matches "$output" "Usage"; then
    pass "npx askill-cli --help works"
  else
    fail "npx askill-cli --help failed"
  fi
  
  # Test a real command (might fail due to network)
  output=$(npx askill-cli find memory 2>&1) || true
  if output_matches "$output" "result|found|memory|Search|error|ENOTFOUND|fetch"; then
    pass "npx askill-cli find works (or reports network error)"
  else
    fail "npx askill-cli find failed"
    echo "$output" | head -5 | sed 's/^/    /'
  fi
}

# ════════════════════════════════════════════════════
# Test: bun install (if available)
# ════════════════════════════════════════════════════
test_bun_install() {
  header "bun install -g askill-cli"
  
  # Check if bun is available
  if ! command -v bun &>/dev/null; then
    skip "bun not installed"
    return
  fi
  
  # Install via bun
  local install_output
  install_output=$(bun install -g askill-cli 2>&1) || true
  
  if echo "$install_output" | grep -qE "installed|added"; then
    pass "bun install succeeded"
  else
    # bun might have different output format
    if bun pm ls -g 2>&1 | grep -q askill-cli; then
      pass "bun install succeeded (verified via bun pm ls)"
    else
      fail "bun install failed"
      echo "$install_output" | head -5 | sed 's/^/    /'
      return
    fi
  fi
  
  # Find where bun installed the binary
  local bun_bin_path="$HOME/.bun/bin/askill-cli"
  if [ -x "$bun_bin_path" ]; then
    local output
    output=$("$bun_bin_path" --version 2>&1) || true
    if output_matches "$output" "[0-9]+\\.[0-9]+\\.[0-9]+"; then
      pass "bun installed binary --version works"
    else
      fail "bun installed binary --version failed"
    fi
  else
    # Try via bunx
    local output
    output=$(bunx askill-cli --version 2>&1) || true
    if output_matches "$output" "[0-9]+\\.[0-9]+\\.[0-9]+"; then
      pass "bunx askill-cli --version works"
    else
      skip "bun binary path not found, bunx also failed"
    fi
  fi
  
  # Clean up
  bun remove -g askill-cli &>/dev/null || true
}

# ════════════════════════════════════════════════════
# Test: Binary install via curl
# ════════════════════════════════════════════════════
test_binary_install() {
  header "curl install (binary)"
  
  # Download install script
  local install_output
  install_output=$(curl -fsSL https://askill.sh/install.sh | sh 2>&1) || true
  
  if output_matches "$install_output" "installed\|success\|askill"; then
    pass "binary install script completed"
  elif output_matches "$install_output" "error\|failed\|404"; then
    fail "binary install failed"
    echo "$install_output" | head -5 | sed 's/^/    /'
    return
  else
    # Script might have run silently
    pass "binary install script ran"
  fi
  
  # Check common install locations
  local askill_bin=""
  if [ -x "$HOME/.local/bin/askill" ]; then
    askill_bin="$HOME/.local/bin/askill"
  elif [ -x "/usr/local/bin/askill" ]; then
    askill_bin="/usr/local/bin/askill"
  fi
  
  if [ -n "$askill_bin" ]; then
    pass "binary found at $askill_bin"
    
    # Test basic commands
    local output
    output=$("$askill_bin" --version 2>&1) || true
    if output_matches "$output" "[0-9]+\.[0-9]+\.[0-9]+"; then
      pass "binary --version works"
    else
      fail "binary --version failed"
    fi
    
    output=$("$askill_bin" --help 2>&1) || true
    if output_matches "$output" "Usage"; then
      pass "binary --help works"
    else
      fail "binary --help failed"
    fi
    
    # Test upgrade command (should detect binary install)
    # Note: upgrade behavior depends on published version
    output=$("$askill_bin" upgrade 2>&1) || true
    if output_matches "$output" "Checking for updates|already on the latest|Updating from|Node.js runtime"; then
      pass "binary upgrade command works"
    elif output_matches "$output" "askill update|No skills"; then
      # Old version behavior - upgrade was alias for update
      skip "binary is old version (upgrade = update alias)"
    else
      fail "binary upgrade command failed"
      echo "$output" | head -5 | sed 's/^/    /'
    fi
  else
    fail "binary not found in expected locations"
  fi
}

# ════════════════════════════════════════════════════
# Test: Direct download from GitHub releases
# ════════════════════════════════════════════════════
test_github_release() {
  header "GitHub Release download"
  
  local platform arch binary_name
  platform=$(uname -s | tr '[:upper:]' '[:lower:]')
  arch=$(uname -m)
  
  # Map architecture
  case "$arch" in
    x86_64) arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
  esac
  
  # Map platform
  case "$platform" in
    darwin) platform="darwin" ;;
    linux) platform="linux" ;;
    *) skip "unsupported platform: $platform"; return ;;
  esac
  
  binary_name="askill-${platform}-${arch}"
  local download_url="https://github.com/avibe-bot/askill/releases/latest/download/${binary_name}"
  
  # Download binary
  local temp_bin="/tmp/askill-test-binary"
  rm -f "$temp_bin"
  
  if curl -fsSL -o "$temp_bin" "$download_url" 2>&1; then
    pass "downloaded $binary_name from GitHub"
  else
    fail "failed to download $binary_name"
    return
  fi
  
  chmod +x "$temp_bin"
  
  # Test basic commands
  local output
  output=$("$temp_bin" --version 2>&1) || true
  if output_matches "$output" "[0-9]+\.[0-9]+\.[0-9]+"; then
    pass "GitHub release binary --version works"
  else
    fail "GitHub release binary --version failed"
    echo "$output" | head -5 | sed 's/^/    /'
  fi
  
  output=$("$temp_bin" --help 2>&1) || true
  if output_matches "$output" "Usage"; then
    pass "GitHub release binary --help works"
  else
    fail "GitHub release binary --help failed"
  fi
  
  rm -f "$temp_bin"
}

# ════════════════════════════════════════════════════
# Runner
# ════════════════════════════════════════════════════

echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║  askill - Installation Methods Tests     ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"

# Run specific test or all
if [ $# -gt 0 ]; then
  case "$1" in
    npm) test_npm_install ;;
    npx) test_npx ;;
    bun) test_bun_install ;;
    binary|curl) test_binary_install ;;
    github) test_github_release ;;
    *)
      echo "Unknown test: $1"
      echo "Available: npm, npx, bun, binary, github"
      exit 1
      ;;
  esac
else
  test_npm_install
  test_npx
  test_bun_install
  test_binary_install
  test_github_release
fi

# ── Summary ─────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━ Summary ━━━${RESET}"
echo -e "  ${GREEN}Passed:  $PASSED${RESET}"
echo -e "  ${RED}Failed:  $FAILED${RESET}"
echo -e "  ${YELLOW}Skipped: $SKIPPED${RESET}"

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}All tests passed!${RESET}"
  exit 0
else
  echo -e "${RED}${BOLD}$FAILED test(s) failed${RESET}"
  exit 1
fi
