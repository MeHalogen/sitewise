# sitewise demo — render with:  vhs scripts/demo.tape
# Install VHS first:  brew install vhs   (or see github.com/charmbracelet/vhs)
# Run from the repo root. The hidden setup below aliases `sitewise` to the
# local build and uses a throwaway config dir so recording touches nothing.

Output demo.gif

Set Shell "bash"
Set FontSize 20
Set Width 1200
Set Height 760
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms

# --- hidden hermetic setup (executed, not recorded) ---
Hide
Type "alias sitewise='node dist/main.js'; export SITEWISE_CONFIG_DIR=$(mktemp -d); clear"
Enter
Sleep 1s
Show

# --- intro ---
Type "# sitewise: the web as tools for your AI agent (and you)"
Enter
Sleep 800ms

# --- sites as commands (API adapters, instant, no key) ---
Type "sitewise hackernews top -l 5"
Sleep 400ms
Enter
Sleep 3s

Type "sitewise npm search 'web framework' -l 5"
Sleep 400ms
Enter
Sleep 3s

Type "sitewise crypto top -l 5"
Sleep 400ms
Enter
Sleep 3s

# --- every site is health-checked; it tells you when one breaks ---
Type "sitewise doctor --adapters --only hackernews,npm,github,wikipedia"
Sleep 400ms
Enter
Sleep 12s

# --- watch the web; get pinged when it changes ---
Type "# watch anything: desktop + Slack/Discord webhook"
Enter
Sleep 600ms
Type "sitewise watch add crypto price bitcoin --field price --below 60000"
Sleep 400ms
Enter
Sleep 2s
Type "sitewise watch list"
Sleep 400ms
Enter
Sleep 2.5s

# --- the rest ---
Type "# for agents:  claude mcp add sitewise -- npx -y sitewise mcp"
Enter
Sleep 3s
