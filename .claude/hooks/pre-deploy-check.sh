#!/bin/bash
# Pre-Deploy Checkliste — läuft vor jedem Bash-Tool-Aufruf der wrangler deploy/migrations enthält

INPUT=$(cat)
CMD=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    try { console.log(JSON.parse(d).tool_input?.command || ''); }
    catch { console.log(''); }
  });
" 2>/dev/null)

# Nur für wrangler deploy oder d1 migrations apply
if ! echo "$CMD" | grep -qE "wrangler.*(pages deploy|d1 migrations apply|deploy)"; then
  exit 0
fi

echo ""
echo "════════════════════════════════════════"
echo "  PRE-DEPLOY CHECKLISTE"
echo "════════════════════════════════════════"

ERRORS=0

# 0. Wrangler Account prüfen (non-blocking — whoami kann im Hook-Subprocess fehlschlagen)
WHOAMI=$(npx wrangler whoami 2>/dev/null | grep -o '[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]*\.[a-zA-Z]*' | head -1)
if [ -z "$WHOAMI" ]; then
  echo "⚠️  Wrangler Account: konnte nicht geprüft werden (non-blocking)"
elif [ "$WHOAMI" = "email@nickkrakow.de" ]; then
  echo "✅ Wrangler Account: $WHOAMI"
else
  echo "⚠️  Wrangler Account: '$WHOAMI' (erwartet: email@nickkrakow.de)"
fi

# 1. wrangler.toml vorhanden?
if [ -f "wrangler.toml" ]; then
  echo "✅ wrangler.toml vorhanden"
else
  echo "❌ wrangler.toml FEHLT — Deploy abgebrochen!"
  ERRORS=$((ERRORS + 1))
fi

# 2. D1-Binding in wrangler.toml konfiguriert?
if grep -q "d1_databases" wrangler.toml 2>/dev/null; then
  DB_NAME=$(grep "database_name" wrangler.toml | head -1 | sed 's/.*= *"\(.*\)"/\1/')
  echo "✅ D1-Binding konfiguriert: $DB_NAME"
else
  echo "⚠️  Kein D1-Binding in wrangler.toml gefunden"
fi

# 3. Pending Migrationen?
MIGRATION_COUNT=$(ls d1-migrations/*.sql 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -gt 0 ]; then
  echo "📋 $MIGRATION_COUNT Migrations-Dateien in d1-migrations/"
  echo "   → Sicherstellen dass alle via CI/CD oder wrangler d1 migrations apply --remote angewendet werden"
fi

# 4. JWT_SECRET Reminder
echo "⚠️  Reminder: JWT_SECRET als Cloudflare Pages Secret gesetzt?"
echo "   → Prüfen: npx wrangler pages secret list --project-name supplementstack"

# 5. Frontend dist vorhanden?
if [ -d "frontend/dist" ]; then
  echo "✅ frontend/dist vorhanden (build existiert)"
else
  echo "⚠️  frontend/dist fehlt — ggf. erst 'npm run build' in frontend/ ausführen"
fi

echo "════════════════════════════════════════"
echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo "❌ $ERRORS kritischer Fehler — bitte beheben!"
  exit 2
fi

exit 0
