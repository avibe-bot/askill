#!/bin/sh
# askill CLI installer
# Usage: curl -fsSL https://askill.sh | sh
#    or: curl -fsSL https://askill.sh | sh -s -- -b /custom/path

set -e

# Configuration
GITHUB_REPO="avibe-bot/askill"
BINARY_NAME="askill"
INSTALL_DIR="${ASKILL_INSTALL_DIR:-$HOME/.local/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() {
  printf "${CYAN}info${NC}  %s\n" "$1"
}

success() {
  printf "${GREEN}✓${NC}     %s\n" "$1"
}

warn() {
  printf "${YELLOW}warn${NC}  %s\n" "$1"
}

error() {
  printf "${RED}error${NC} %s\n" "$1"
  exit 1
}

# Parse arguments
while [ $# -gt 0 ]; do
  case "$1" in
    -b|--bin-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    -v|--version)
      VERSION="$2"
      shift 2
      ;;
    -h|--help)
      echo "askill CLI installer"
      echo ""
      echo "Usage: curl -fsSL https://askill.sh | sh"
      echo ""
      echo "Options:"
      echo "  -b, --bin-dir <dir>   Installation directory (default: ~/.local/bin)"
      echo "  -v, --version <ver>   Install specific version (default: latest)"
      echo "  -h, --help            Show this help"
      exit 0
      ;;
    *)
      shift
      ;;
  esac
done

# Detect OS and architecture
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Linux)   OS="linux" ;;
    Darwin)  OS="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) OS="win32" ;;
    *)       error "Unsupported OS: $OS" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)             error "Unsupported architecture: $ARCH" ;;
  esac

  PLATFORM="${OS}-${ARCH}"
}

# Get latest version from GitHub API
get_latest_version() {
  if [ -n "$VERSION" ]; then
    echo "$VERSION"
    return
  fi

  # Try GitHub API first
  LATEST=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
  
  if [ -z "$LATEST" ]; then
    # Fallback: try askill.sh API
    LATEST=$(curl -fsSL "https://askill.sh/api/v1/cli/version" 2>/dev/null | grep '"latest"' | sed -E 's/.*"latest"[^"]*"([^"]+)".*/\1/')
    if [ -n "$LATEST" ]; then
      LATEST="v${LATEST}"
    fi
  fi

  if [ -z "$LATEST" ]; then
    error "Failed to get latest version. Please specify version with -v flag."
  fi

  echo "$LATEST"
}

# Download and install binary
install() {
  detect_platform
  info "Detected platform: ${PLATFORM}"

  VERSION=$(get_latest_version)
  info "Installing askill ${VERSION}..."

  # Build download URL
  DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${VERSION}/${BINARY_NAME}-${PLATFORM}"
  
  if [ "$OS" = "win32" ]; then
    DOWNLOAD_URL="${DOWNLOAD_URL}.exe"
    BINARY_NAME="${BINARY_NAME}.exe"
  fi

  # Create install directory
  mkdir -p "$INSTALL_DIR"

  # Download binary
  info "Downloading from ${DOWNLOAD_URL}..."
  TMP_FILE=$(mktemp)
  
  if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -fsSL -w "%{http_code}" -o "$TMP_FILE" "$DOWNLOAD_URL" 2>/dev/null) || true
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$TMP_FILE" "$DOWNLOAD_URL" 2>/dev/null && HTTP_CODE="200" || HTTP_CODE="404"
  else
    error "Neither curl nor wget found. Please install one of them."
  fi

  if [ "$HTTP_CODE" != "200" ]; then
    rm -f "$TMP_FILE"
    error "Download failed (HTTP $HTTP_CODE). Version ${VERSION} may not exist for ${PLATFORM}."
  fi

  # Install binary
  INSTALL_PATH="${INSTALL_DIR}/${BINARY_NAME}"
  mv "$TMP_FILE" "$INSTALL_PATH"
  chmod +x "$INSTALL_PATH"

  success "Installed askill to ${INSTALL_PATH}"

  # Check if install directory is in PATH
  check_path
}

# Check if install directory is in PATH
check_path() {
  case ":$PATH:" in
    *":$INSTALL_DIR:"*)
      success "askill is ready to use!"
      ;;
    *)
      warn "Add ${INSTALL_DIR} to your PATH to use askill"
      echo ""
      echo "Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
      echo ""
      echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
      echo ""
      echo "Then restart your terminal or run:"
      echo ""
      echo "  source ~/.bashrc  # or ~/.zshrc"
      ;;
  esac

  echo ""
  echo "Get started:"
  echo ""
  echo "  ${CYAN}askill --help${NC}          Show help"
  echo "  ${CYAN}askill find${NC}            Search for skills"
  echo "  ${CYAN}askill add <skill>${NC}     Install a skill"
  echo ""
  echo "Browse skills at ${CYAN}https://askill.sh${NC}"
}

# Run installer
main() {
  echo ""
  echo "  █████╗ ███████╗██╗  ██╗██╗██╗     ██╗     "
  echo " ██╔══██╗██╔════╝██║ ██╔╝██║██║     ██║     "
  echo " ███████║███████╗█████╔╝ ██║██║     ██║     "
  echo " ██╔══██║╚════██║██╔═██╗ ██║██║     ██║     "
  echo " ██║  ██║███████║██║  ██╗██║███████╗███████╗"
  echo " ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝"
  echo ""
  echo " The Agent Skill Package Manager"
  echo ""
  
  install
}

main
