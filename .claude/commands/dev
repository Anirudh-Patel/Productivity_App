#!/bin/bash

# Development utilities for Life Gamification App

case "$1" in
  "web")
    echo "🌐 Starting Vite development server (web only)..."
    cd /Users/anirudhpatel/Projects/Productivity_App/life-gamification
    npm run dev
    ;;
  "build")
    echo "🔨 Building the application..."
    cd /Users/anirudhpatel/Projects/Productivity_App/life-gamification
    npm run build
    ;;
  "tauri:build")
    echo "📦 Building Tauri application..."
    cd /Users/anirudhpatel/Projects/Productivity_App/life-gamification
    npm run tauri:build
    ;;
  "lint")
    echo "🔍 Running linter..."
    cd /Users/anirudhpatel/Projects/Productivity_App/life-gamification
    npm run lint
    ;;
  *)
    echo "Usage: /dev [web|build|tauri:build|lint]"
    echo ""
    echo "Commands:"
    echo "  web         - Start Vite dev server (web only)"
    echo "  build       - Build the web application"
    echo "  tauri:build - Build the Tauri desktop app"
    echo "  lint        - Run ESLint"
    ;;
esac