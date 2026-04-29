#!/bin/bash
# Error Capture — schreibt wrangler-Fehler automatisch in deploy-errors.log

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
    try {
      const i = JSON.parse(d);
      console.log((i.tool_response?.output || '') + '\n' + (i.tool_response?.error || ''));
    }
    catch { console.log(''); }
  });
" 2>/dev/null)

# Nur für wrangler-Befehle
if ! echo "$CMD" | grep -q "wrangler"; then
  exit 0
fi

# Fehler im Output suchen
if ! echo "$OUTPUT" | grep -qiE "\[ERROR\]|error:|failed|Authentication error|code: [0-9]"; then
  exit 0
fi

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE=".claude/deploy-errors.log"

{
  echo "═══════════════════════════════════════════"
  echo "FEHLER: $TIMESTAMP"
  echo "BEFEHL: $CMD"
  echo "───────────────────────────────────────────"
  echo "$OUTPUT" | grep -iE "\[ERROR\]|error:|failed|Authentication error|code: [0-9]" | head -20
  echo ""
} >> "$LOG_FILE"

exit 0
