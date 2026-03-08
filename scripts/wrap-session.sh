#!/bin/bash
# ─────────────────────────────────────────────
# wrap-session.sh
# saves updated docs, increments version, commits to github
#
# usage:
#   ./scripts/wrap-session.sh \
#     "SDB_master_context_V4.md" \
#     "SDB_site_plan_V4.md" \
#     "brief description of what was built"
#
# the script expects the new doc files to already exist in docs/
# claude should write them there during wrap-up before calling this
# ─────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$REPO_ROOT/docs"
NEW_CONTEXT="$1"
NEW_PLAN="$2"
COMMIT_MSG="$3"
# ── validation ──────────────────────────────
if [ -z "$NEW_CONTEXT" ] || [ -z "$NEW_PLAN" ] || [ -z "$COMMIT_MSG" ]; then
echo ""
echo "⚠  usage: ./scripts/wrap-session.sh \"SDB_master_context_V4.md\" \"SDB_site_plan_V4.md\" \"what was built\""
echo ""
exit 1
fi
if [ ! -f "$DOCS_DIR/$NEW_CONTEXT" ]; then
echo ""
echo "⚠  file not found: docs/$NEW_CONTEXT"
echo "   make sure claude has written the updated doc to the docs/ folder before running this script"
echo ""
exit 1
fi
if [ ! -f "$DOCS_DIR/$NEW_PLAN" ]; then
echo ""
echo "⚠  file not found: docs/$NEW_PLAN"
echo "   make sure claude has written the updated doc to the docs/ folder before running this script"
echo ""
exit 1
fi
# ── confirm before committing ───────────────
echo ""
echo "─────────────────────────────────────────"
echo "  somebody died beverly — session wrap-up"
echo "─────────────────────────────────────────"
echo ""
echo "  new context doc : $NEW_CONTEXT"
echo "  new site plan   : $NEW_PLAN"
echo "  commit message  : docs: $COMMIT_MSG"
echo ""
echo "  the following will be committed:"
cd "$REPO_ROOT" && git status --short
echo ""
read -p "  commit and push? (y/n): " CONFIRM
echo ""
if [ "$CONFIRM" != "y" ]; then
echo "  aborted. no changes committed."
echo ""
exit 0
fi
# ── commit and push ──────────────────────────
cd "$REPO_ROOT"
git add .
git commit -m "docs: $COMMIT_MSG
updated docs:
- $NEW_CONTEXT
- $NEW_PLAN"
if [ $? -ne 0 ]; then
echo ""
echo "⚠  git commit failed. check the output above."
echo ""
exit 1
fi
git push
if [ $? -ne 0 ]; then
echo ""
echo "⚠  git push failed. your commit is saved locally but not pushed."
echo "   run: git push"
echo ""
exit 1
fi
# ── done ────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
echo "  ✓ session docs saved and pushed"
echo ""
echo "  next session: ./scripts/new-session.sh"
echo "─────────────────────────────────────────"
echo ""
