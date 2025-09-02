#!/bin/bash

# Start the Life Gamification App in development mode
cd /Users/anirudhpatel/Projects/Productivity_App/life-gamification

echo "🎮 Starting Life Gamification App..."
echo "📦 Installing dependencies if needed..."
npm install

echo "🚀 Launching Tauri development server..."
npm run tauri:dev