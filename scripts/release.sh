#!/bin/bash
# askill version bump and release script
# Usage: ./scripts/release.sh [patch|minor|major]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default to patch bump
BUMP_TYPE="${1:-patch}"

if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo -e "${RED}Error: Invalid bump type '$BUMP_TYPE'${NC}"
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${CYAN}Current version: ${NC}${CURRENT_VERSION}"

# Calculate new version
IFS='.' read -r major minor patch <<< "$CURRENT_VERSION"
case "$BUMP_TYPE" in
  major) ((major++)); minor=0; patch=0 ;;
  minor) ((minor++)); patch=0 ;;
  patch) ((patch++)) ;;
esac
NEW_VERSION="${major}.${minor}.${patch}"
echo -e "${GREEN}New version: ${NC}${NEW_VERSION}"

# Confirm
read -p "Continue with release v${NEW_VERSION}? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Update package.json
echo -e "${CYAN}Updating package.json...${NC}"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update constants.ts
echo -e "${CYAN}Updating src/constants.ts...${NC}"
sed -i.bak "s/export const VERSION = '.*'/export const VERSION = '${NEW_VERSION}'/" src/constants.ts
rm -f src/constants.ts.bak

# Build to verify
echo -e "${CYAN}Building...${NC}"
npm run build

# Git commit and tag
echo -e "${CYAN}Creating git commit and tag...${NC}"
git add package.json src/constants.ts
git commit -m "chore: release v${NEW_VERSION}"
git tag -a "v${NEW_VERSION}" -m "Release v${NEW_VERSION}"

echo ""
echo -e "${GREEN}✓ Version bumped to ${NEW_VERSION}${NC}"
echo ""
echo "Next steps:"
echo -e "  ${CYAN}git push origin main${NC}           Push commit"
echo -e "  ${CYAN}git push origin v${NEW_VERSION}${NC}    Push tag (triggers release)"
echo ""
echo "Or push both at once:"
echo -e "  ${CYAN}git push origin main --tags${NC}"
