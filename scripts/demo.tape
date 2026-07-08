# sitewise demo — render with:  vhs scripts/demo.tape
# Install VHS first:  brew install vhs   (or see github.com/charmbracelet/vhs)
# Prereq: `sitewise` on PATH (npm i -g sitewise) or alias sitewise="node dist/main.js"

Output demo.gif

Set Shell "bash"
Set FontSize 20
Set Width 1200
Set Height 760
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 45ms

# --- intro ---
Type "# sitewise — control the web from your terminal"
Enter
Sleep 1s

# --- sites as commands (API adapters, instant) ---
Type "sitewise hackernews top -l 5"
Sleep 500ms
Enter
Sleep 3s

Type "sitewise npm search 'web framework' -l 5"
Sleep 500ms
Enter
Sleep 3s

Type "sitewise github search 'language:go cli' -l 5"
Sleep 500ms
Enter
Sleep 3s

Type "sitewise weather now 'Tokyo'"
Sleep 500ms
Enter
Sleep 3s

# --- machine-readable too ---
Type "sitewise crypto top -l 5 --json | head -12"
Sleep 500ms
Enter
Sleep 3s

# --- the agent angle ---
Type "# 51 sites. plug them all into your AI agent:  sitewise mcp"
Enter
Sleep 2.5s
