#!/bin/bash
#
# CloakShare — Community Mention Monitor
#
# Queries Hacker News (Algolia API) and Reddit (RSS) for mentions of
# keywords related to document sharing, DocSend, and pitch decks.
#
# Usage:
#   bash scripts/monitor.sh
#
# To run daily via cron (e.g., every morning at 8am):
#   0 8 * * * /path/to/scripts/monitor.sh >> /path/to/monitor.log 2>&1
#
# Dependencies: curl, jq (optional — falls back to raw JSON if missing)

set -euo pipefail

HAS_JQ=false
if command -v jq &>/dev/null; then
  HAS_JQ=true
fi

SEPARATOR="────────────────────────────────────────────────────────"

echo ""
echo "=========================================================="
echo "  CloakShare Community Monitor — $(date '+%Y-%m-%d %H:%M')"
echo "=========================================================="

# ─── Hacker News (Algolia API) ────────────────────────────────

hn_search() {
  local query="$1"
  local label="$2"
  local encoded_query
  encoded_query=$(printf '%s' "$query" | sed 's/ /%20/g')
  local url="https://hn.algolia.com/api/v1/search_by_date?query=${encoded_query}&tags=(story,comment)&hitsPerPage=10"

  echo ""
  echo "$SEPARATOR"
  echo "  HN: \"${query}\""
  echo "$SEPARATOR"

  local response
  response=$(curl -s --max-time 10 "$url" 2>/dev/null) || {
    echo "  [ERROR] Failed to fetch HN results for \"${query}\""
    return
  }

  if $HAS_JQ; then
    local count
    count=$(echo "$response" | jq '.hits | length')

    if [[ "$count" == "0" ]]; then
      echo "  No recent results."
      return
    fi

    echo "$response" | jq -r '.hits[] | "  [\(.created_at | split("T")[0])] \(if .title then .title else .comment_text[0:120] end)\n    -> https://news.ycombinator.com/item?id=\(if .story_id then .story_id else .objectID end)\n"'
  else
    echo "  (install jq for formatted output)"
    echo "$response" | head -c 2000
    echo ""
  fi
}

hn_search "docsend" "DocSend"
hn_search "document sharing" "Document Sharing"
hn_search "pitch deck" "Pitch Deck"

# ─── Reddit (RSS) ─────────────────────────────────────────────

reddit_search() {
  local subreddit="$1"
  local query="$2"
  local encoded_query
  encoded_query=$(printf '%s' "$query" | sed 's/ /+/g')
  local url="https://www.reddit.com/r/${subreddit}/search.json?q=${encoded_query}&sort=new&restrict_sr=on&limit=10"

  echo ""
  echo "$SEPARATOR"
  echo "  Reddit r/${subreddit}: \"${query}\""
  echo "$SEPARATOR"

  local response
  response=$(curl -s --max-time 10 -H "User-Agent: CloakShareMonitor/1.0" "$url" 2>/dev/null) || {
    echo "  [ERROR] Failed to fetch Reddit results for r/${subreddit} \"${query}\""
    return
  }

  if $HAS_JQ; then
    local count
    count=$(echo "$response" | jq '.data.children | length' 2>/dev/null)

    if [[ -z "$count" || "$count" == "0" || "$count" == "null" ]]; then
      echo "  No recent results."
      return
    fi

    echo "$response" | jq -r '.data.children[] | .data | "  [\(.created_utc | todate | split("T")[0])] \(.title)\n    -> https://reddit.com\(.permalink)\n"' 2>/dev/null || {
      echo "  [ERROR] Failed to parse Reddit response."
    }
  else
    echo "  (install jq for formatted output)"
    echo "$response" | head -c 2000
    echo ""
  fi
}

reddit_search "selfhosted" "document sharing"
reddit_search "selfhosted" "docsend"
reddit_search "opensource" "document sharing"
reddit_search "opensource" "docsend"

# ─── Summary ──────────────────────────────────────────────────

echo ""
echo "$SEPARATOR"
echo "  Done. Run again tomorrow or set up a cron job."
echo "$SEPARATOR"
echo ""
