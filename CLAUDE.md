# Claude Code Assistant - Self-Aware Configuration
## Life Gamification Productivity App

## 🚨 SELF-AWARENESS PROTOCOL
Before doing ANY task, check if CLAUDE.md exists in the current directory.
If it doesn't exist:
1. Copy this template from ~/claude-templates/CLAUDE.md
2. Detect the project type and customize the template
3. Create WORKING_NOTES.md from template
4. THEN proceed with the requested task
You should do this AUTOMATICALLY without asking permission.


# Using Gemini CLI for Large Codebase Analysis

When analyzing large codebases or multiple files that might exceed context limits, use the Gemini-cli MCP with its massive
context window.

#### At the start of EVERY session:
```bash
# Analyze project structure with Gemini
echo "Analyzing project with Gemini..."
find . -type f \( -name "*.js" -o -name "*.py" -o -name "*.ts" -o -name "*.jsx" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | head -50 | xargs cat | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze this codebase: architecture, patterns, tech stack, recent changes"

# Check git history
git log --oneline -10 | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Summarize recent development activity"
```

#### For codebase-wide operations:
```bash
# Finding all references
grep -r "search_term" . --include="*.js" --include="*.py" | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze these references and their patterns"

# Before refactoring
find . -name "*.js" -type f | xargs grep -l "function_name" | xargs cat | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze impact of refactoring this function"

# Bug investigation
grep -r "error" . --include="*.log" --include="*.js" | tail -100 | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Identify root cause and patterns"
```


#### At the start of EVERY session:
```bash
# Analyze project structure with Gemini
echo "Analyzing project with Gemini..."
find . -type f \( -name "*.js" -o -name "*.py" -o -name "*.ts" -o -name "*.jsx" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | head -50 | xargs cat | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze this codebase: architecture, patterns, tech stack, recent changes"

# Check git history
git log --oneline -10 | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Summarize recent development activity"
```

#### For codebase-wide operations:
```bash
# Finding all references
grep -r "search_term" . --include="*.js" --include="*.py" | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze these references and their patterns"

# Before refactoring
find . -name "*.js" -type f | xargs grep -l "function_name" | xargs cat | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze impact of refactoring this function"

# Bug investigation
grep -r "error" . --include="*.log" --include="*.js" | tail -100 | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Identify root cause and patterns"
```

## 📚 REF MCP - Knowledge Storage

### Save important discoveries:
```bash
# Architecture decisions
ref add "arch:[component]" "[decision and why]"

# Bug fixes
ref add "fix:[date]-[bug]" "Problem: X, Solution: Y"

# Code patterns
ref add "pattern:[name]" "[pattern description]"

# Session summaries
ref add "session:[date]" "Completed: X, Issues: Y, Next: Z"
Check existing knowledge:
bash# At session start
ref list
ref search "[what I'm working on]"

# Before refactoring
ref get "arch:[component]"

# When debugging
ref search "[error]"
Ref + Gemini Combo:
bash# Analyze once with Gemini
gemini -p "analyze architecture" < codebase.tar
# Save to ref for future sessions
ref add "architecture" "[Gemini's analysis]"
Naming Convention:

arch:* - architecture decisions
fix:* - bug fixes
pattern:* - code patterns
session:YYYY-MM-DD - daily summaries

## 📝 DOCUMENTATION PROTOCOL
Maintain these files (create if missing):

- **WORKING_NOTES.md** - Update after EVERY significant change
- **PROJECT_TODO.md** - Track discovered issues and future tasks (EXISTS)
- **PROJECT_STATUS.md** - High-level project status (EXISTS)
- **AVATAR_SYSTEM_TODO.md** - Avatar system implementation tracking (EXISTS)

Auto-update WORKING_NOTES.md with:
```markdown
## [$(date +%Y-%m-%d)] - Session $(date +%H:%M)
**Task:** [What was requested]
**Approach:** [How you solved it]
**Changes:** [Files modified]
**Decisions:** [Key choices and why]
**Issues Found:** [Any problems discovered]
**Next Steps:** [What should be done next]
---
```

## 🔄 AUTOMATIC WORKFLOWS

### When asked to debug:
1. First run: `grep -r "error_pattern" . | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze error patterns"`
2. Then run: `cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Suggest fixes for these errors" < problematic_file.js`
3. Implement fix based on Gemini's analysis
4. Document in WORKING_NOTES.md

### When asked to refactor:
1. First run: `find . -name "*.js" | xargs grep -l "component_name" | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze dependencies"`
2. Create refactoring plan based on analysis
3. Implement changes
4. Run: `git diff | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Review these changes for potential issues"`

### When asked about "the entire codebase":
ALWAYS use Gemini first:
```bash
find . -type f -name "*.js" -o -name "*.py" | xargs cat | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Provide comprehensive codebase analysis"
```

## ⚙️ PROJECT-SPECIFIC CONFIGURATION

- **Detected Project Type:** Life Gamification Productivity App (Tauri Desktop)
- **Primary Language:** TypeScript
- **Framework:** React 19 + Tauri 2.0 + Vite
- **Package Manager:** npm
- **Database:** SQLite with @tauri-apps/plugin-sql
- **State Management:** Zustand
- **Styling:** Tailwind CSS + Framer Motion
- **Test Command:** npm run lint (no tests configured yet)
- **Build Command:** npm run build OR npm run tauri:build
- **Dev Command:** npm run tauri:dev

### Key Project Features:
- **RPG-style gamification** with XP, levels, stats, achievements
- **Quest system** with standard tasks, goal-based tasks, recurring tasks
- **Quest chains** with anime-inspired storylines (Solo Leveling, Attack on Titan, etc.)
- **Shop system** with purchasable items and upgrades
- **Avatar system** (in development - placeholder graphics)
- **Performance monitoring** and optimization
- **Keyboard shortcuts** and responsive design

### Current Project State:
- **Phase:** Fully functional MVP with advanced features
- **Status:** Production-ready with 9 quest chains, complete shop system
- **Recent Work:** Avatar system architecture planning
- **Next Focus:** Avatar system implementation (see AVATAR_SYSTEM_TODO.md)

## 🎯 TOKEN OPTIMIZATION RULES

- **NEVER** load files >500 lines directly - ALWAYS use Gemini first
- **NEVER** read node_modules, .git, build, or dist directories
- **ALWAYS** use Gemini for multi-file analysis
- **ALWAYS** update WORKING_NOTES.md to preserve context between sessions
- **PREFER** asking Gemini to analyze patterns rather than reading many files

## 🚫 FORBIDDEN ACTIONS

- Don't modify migration files without explicit permission
- Don't change .env.production or production configs
- Don't read package-lock.json or yarn.lock directly (too large)
- Don't load minified or built files
- Don't modify existing quest chains without understanding storyline impact

## 💡 SMART PATTERNS FOR THIS PROJECT

### Pattern: Large File Editing (TSX Components)
```bash
# Don't load the whole file
cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Show me just the function named 'functionName' from file.tsx" < file.tsx
# Edit just that function
```

### Pattern: Finding Quest Chain Dependencies
```bash
find life-gamification/src -name "*.ts" -o -name "*.tsx" | xargs grep -l "questChains" | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze quest chain system dependencies and structure"
```

### Pattern: Zustand Store Analysis
```bash
find life-gamification/src/store -name "*.ts" | xargs cat | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze store structure and state management patterns"
```

### Pattern: Avatar System Development
```bash
find life-gamification/src -name "*avatar*" -o -name "*Avatar*" | cd /tmp && export GEMINI_API_KEY=AIzaSyAbyg45D-SL2nA_Ujiz30XHmzCHrl43Aq8 && gemini "Analyze current avatar system implementation and identify next development steps"
```

## 🔧 PROJECT-SPECIFIC COMMANDS

### Development Workflow:
- **Start Development**: `cd life-gamification && npm run tauri:dev`
- **Web Only**: `cd life-gamification && npm run dev`
- **Build Desktop**: `cd life-gamification && npm run tauri:build`
- **Lint Check**: `cd life-gamification && npm run lint`
- **Type Check**: `cd life-gamification && npm run build:check`

### Database Operations:
- **Database Location**: `life-gamification/src-tauri/migrations/`
- **Migration Files**: `001_initial.sql`, `002_avatar_system.sql` (planned)
- **Tauri Commands**: Located in `life-gamification/src-tauri/src/commands/`

### Common File Locations:
- **Components**: `life-gamification/src/components/`
- **Pages**: `life-gamification/src/pages/`
- **Store**: `life-gamification/src/store/`
- **Utils**: `life-gamification/src/utils/`
- **Types**: `life-gamification/src/types/`

**USE THESE PATTERNS LIBERALLY TO SAVE TOKENS!**
