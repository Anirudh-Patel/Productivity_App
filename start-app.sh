#!/bin/bash

# Start the Life Gamification App in development mode
echo "🎮 Starting Life Gamification App..."

cd /Users/anirudhpatel/Projects/Productivity_App/life-gamification

echo "📦 Installing dependencies if needed..."
npm install

echo "🚀 Launching Tauri development server..."
npm run tauri:dev