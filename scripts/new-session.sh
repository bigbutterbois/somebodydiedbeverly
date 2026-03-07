#!/bin/bash
# ─────────────────────────────────────────────
# new-session.sh
# starts a new claude code session for somebodydiedbeverly
# usage: ./scripts/new-session.sh
# ─────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$REPO_ROOT/docs"
# find latest versions
LATEST_CONTEXT=$(ls "$DOCS_DIR"/SDB_master_context_*.md 2>/dev/null | sort -V | tail -1)
LATEST_PLAN=$(ls "$DOCS_DIR"/SDB_site_plan_*.md 2>/dev/null | sort -V | tail -1)
echo ""
echo "─────────────────────────────────────────"
echo "  somebody died beverly — new session"
echo "─────────────────────────────────────────"
echo ""
if [ -z "$LATEST_CONTEXT" ] || [ -z "$LATEST_PLAN" ]; then
echo "⚠  could not find context docs in $DOCS_DIR"
echo "   make sure docs/ contains SDB_master_context_V*.md and SDB_site_plan_V*.md"
echo ""
exit 1
fi
CONTEXT_FILE=$(basename "$LATEST_CONTEXT")
PLAN_FILE=$(basename "$LATEST_PLAN")
echo "  context doc : $CONTEXT_FILE"
echo "  site plan   : $PLAN_FILE"
echo "  design ref  : SDB_design_mockup_V2.html"
echo ""
echo "─────────────────────────────────────────"
echo "  git status"
echo "─────────────────────────────────────────"
echo ""
cd "$REPO_ROOT" && git status --short
echo ""
echo "─────────────────────────────────────────"
echo "  starting claude code..."
echo "  CLAUDE.md will auto-load the hard rules."
echo "  claude will read the docs above on start."
echo "─────────────────────────────────────────"
echo ""
# launch claude code from repo root
cd "$REPO_ROOT" && claude
