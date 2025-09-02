#!/bin/bash

# Testing and validation commands for Life Gamification App

cd /Users/anirudhpatel/Projects/Productivity_App/life-gamification

case "$1" in
  "typecheck")
    echo "📝 Running TypeScript type checking..."
    npx tsc --noEmit
    ;;
  "lint")
    echo "🔍 Running ESLint..."
    npm run lint
    ;;
  "all")
    echo "🧪 Running all checks..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📝 TypeScript Check..."
    npx tsc --noEmit
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 ESLint Check..."
    npm run lint
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ All checks complete!"
    ;;
  *)
    echo "Usage: /test [typecheck|lint|all]"
    echo ""
    echo "Commands:"
    echo "  typecheck - Run TypeScript type checking"
    echo "  lint      - Run ESLint"
    echo "  all       - Run all tests and checks"
    ;;
esac