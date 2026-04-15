#!/bin/bash

# 1. Stop the script immediately if any command fails
set -e

echo "🚀 Starting deployment of Habits App..."

# 2. Fetch the latest changes from GitHub
echo "📥 Downloading the latest version of the code..."
git pull origin main

# 3. Rebuild and start the containers in the background
echo "🏗️ Building images and starting services..."
# We use sudo because docker commands require it on your server
sudo docker compose up -d --build

# 4. Spring cleaning (Vital to avoid filling up the server's disk)
echo "🧹 Cleaning up old and dangling images..."
# -f forces the cleanup without prompting (Y/N), ideal for automation
sudo docker image prune -f

echo "✅ Deployment completed successfully! Your app is updated in production."