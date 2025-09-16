#!/bin/bash

# Cloudflare Helper Script für Supplement Stack
# Stellt verschiedene Cloudflare-Operationen bereit

set -e

# Load configuration if exists
if [[ -f ".cloudflare-config" ]]; then
    source .cloudflare-config
    export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN"
    export CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID"
fi

show_help() {
    echo "🔧 Cloudflare Helper für Supplement Stack"
    echo "========================================"
    echo ""
    echo "Verwendung: $0 [BEFEHL]"
    echo ""
    echo "Verfügbare Befehle:"
    echo "  deploy          - Vollständiges Deployment nach Cloudflare"
    echo "  status          - Zeigt aktuellen Deployment-Status"
    echo "  logs            - Zeigt aktuelle Logs"
    echo "  db-status       - Zeigt D1-Datenbank Status"
    echo "  db-migrate      - Führt Datenbank-Migrationen aus"
    echo "  db-seed         - Seeded die Datenbank mit Testdaten"
    echo "  config          - Zeigt aktuelle Konfiguration"
    echo "  help            - Zeigt diese Hilfe"
    echo ""
    echo "Beispiele:"
    echo "  $0 deploy       - Deployt das komplette Projekt"
    echo "  $0 status       - Zeigt den aktuellen Status"
    echo "  $0 db-migrate   - Aktualisiert die Datenbank"
}

check_config() {
    if [[ ! -f ".cloudflare-config" ]]; then
        echo "❌ Keine .cloudflare-config gefunden!"
        echo "   Bitte erstellen Sie die Konfigurationsdatei zuerst."
        exit 1
    fi
}

show_config() {
    check_config
    echo "📋 Aktuelle Cloudflare-Konfiguration:"
    echo "=================================="
    echo "Account: $CLOUDFLARE_EMAIL"
    echo "Projekt: $PROJECT_NAME"  
    echo "Domain: $CLOUDFLARE_DOMAIN"
    echo "Branch: $PRODUCTION_BRANCH"
    echo "Database: $DATABASE_NAME"
    echo ""
}

deploy() {
    echo "🚀 Starte Deployment..."
    ./deploy-cloudflare.sh
}

show_status() {
    check_config
    echo "📊 Cloudflare Pages Status für $PROJECT_NAME:"
    echo "==========================================="
    wrangler pages project list | grep "$PROJECT_NAME" || echo "Projekt nicht gefunden"
    echo ""
}

show_logs() {
    check_config
    echo "📋 Aktuelle Logs für $PROJECT_NAME:"
    echo "================================="
    wrangler pages deployment tail --project-name="$PROJECT_NAME" --format=pretty
}

db_status() {
    check_config
    echo "💾 D1 Database Status:"
    echo "===================="
    wrangler d1 info "$DATABASE_NAME" || echo "Database nicht gefunden"
    echo ""
    echo "Tabellen:"
    wrangler d1 execute "$DATABASE_NAME" --command="SELECT name FROM sqlite_master WHERE type='table';" || echo "Keine Verbindung zur Database"
}

db_migrate() {
    check_config
    echo "🗃️  Führe Database-Migrationen aus..."
    wrangler d1 migrations apply "$DATABASE_NAME"
    echo "✅ Migrationen abgeschlossen!"
}

db_seed() {
    check_config
    echo "🌱 Seede Database mit Testdaten..."
    wrangler d1 execute "$DATABASE_NAME" --file=./seed.sql
    echo "✅ Database erfolgreich geseeded!"
}

# Main command processing
case "$1" in
    deploy)
        deploy
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    db-status)
        db_status
        ;;
    db-migrate)
        db_migrate
        ;;
    db-seed)
        db_seed
        ;;
    config)
        show_config
        ;;
    help|--help|-h)
        show_help
        ;;
    "")
        show_help
        ;;
    *)
        echo "❌ Unbekannter Befehl: $1"
        echo "Verwenden Sie '$0 help' für verfügbare Befehle."
        exit 1
        ;;
esac