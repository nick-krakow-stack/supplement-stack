#!/bin/bash
# Post-Deploy Log — schreibt nach jedem wrangler-Deploy Zeitstempel + Details in SESSION.md

INPUT=$(cat)

CMD=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input?.command || ''); }
    catch { console.log(''); }
  });
" 2>/dev/null)

OUTPUT=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_response?.output || ''); }
    catch { console.log(''); }
  });
" 2>/dev/null)

# Nur für erfolgreiche wrangler deploys/migrations
if ! echo "$CMD" | grep -qE "wrangler.*(pages deploy|d1 migrations apply|deploy)"; then
  exit 0
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unbekannt")
GIT_MSG=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")

# Deploy-Typ bestimmen
if echo "$CMD" | grep -q "d1 migrations"; then
  DEPLOY_TYPE="D1 Migrations"
  DEPLOY_ICON="🗄️"
elif echo "$CMD" | grep -q "pages"; then
  DEPLOY_TYPE="Cloudflare Pages (Frontend + Functions)"
  DEPLOY_ICON="🚀"
else
  DEPLOY_TYPE="Wrangler Deploy"
  DEPLOY_ICON="📦"
fi

SESSION_FILE=".claude/SESSION.md"

# SESSION.md anlegen falls nicht vorhanden
if [ ! -f "$SESSION_FILE" ]; then
  echo "# SESSION.md — Supplement Stack" > "$SESSION_FILE"
  echo "" >> "$SESSION_FILE"
fi

# Deploy-Eintrag anhängen
cat >> "$SESSION_FILE" << EOF

---
### $DEPLOY_ICON Deploy: $TIMESTAMP
- **Commit:** \`$GIT_HASH\` — $GIT_MSG
- **Typ:** $DEPLOY_TYPE
- **Befehl:** \`$(echo "$CMD" | head -c 120)\`
EOF

# Erfolg/Fehler aus Output ableiten
if echo "$OUTPUT" | grep -qi "error\|failed\|FAILED"; then
  echo "- **Status:** ❌ Fehler erkannt (siehe deploy-errors.log)" >> "$SESSION_FILE"
else
  echo "- **Status:** ✅ Erfolgreich" >> "$SESSION_FILE"
fi

exit 0
