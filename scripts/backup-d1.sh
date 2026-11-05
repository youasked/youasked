#!/bin/zsh
# Daily copy of the production database (Cloudflare D1 "youasked") to ~/Backups/youasked, kept 30 days.
# D1 Time Travel already allows restores within Cloudflare; this is the copy that lives somewhere else.
# Run by ~/Library/LaunchAgents/dev.youasked.backup.plist. Restore: wrangler d1 execute youasked --remote --file <dump.sql>
set -e
umask 077   # the dump holds app secret keys and user emails
export PATH="/Users/adenteo/.nvm/versions/node/v23.7.0/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"
export NODE_OPTIONS="--dns-result-order=ipv4first"
DIR="$HOME/Backups/youasked"
# On failure, say so in Telegram: bot token from ~/claudeclaw/.env, chat id from ~/.config/youasked/alerts.env.
notify_fail() {
  local tok; tok=$(grep -E '^(TELEGRAM_BOT_TOKEN|BOT_TOKEN)=' "$HOME/claudeclaw/.env" | head -1 | cut -d= -f2- | tr -d '"')
  [ -n "$tok" ] && curl -s -o /dev/null --data-urlencode "text=YouAsked: the nightly database backup failed. Run ~/youasked/scripts/backup-d1.sh to see why (often: npx wrangler login)." -d chat_id="$(grep -E '^ALERT_CHAT_ID=' "$HOME/.config/youasked/alerts.env" | cut -d= -f2)" "https://api.telegram.org/bot$tok/sendMessage"
}
trap notify_fail ERR
STAMP=$(date +%Y-%m-%d)
cd "$HOME/youasked/apps/api"
npx wrangler d1 export youasked --remote --output "$DIR/youasked-$STAMP.sql" >/dev/null 2>&1
gzip -f "$DIR/youasked-$STAMP.sql"
find "$DIR" -name 'youasked-*.sql.gz' -mtime +30 -delete
echo "$(date '+%F %T') backed up $(du -h "$DIR/youasked-$STAMP.sql.gz" | cut -f1)" >> "$DIR/backup.log"
