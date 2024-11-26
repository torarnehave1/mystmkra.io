#!/bin/bash

echo "Pulling the latest changes from GitHub..."
git pull || { echo "Git pull failed! Exiting."; exit 1; }

echo "Stopping the PM2 process 'myst'..."
pm2 stop myst || { echo "PM2 stop failed! Exiting."; exit 1; }

echo "Starting the PM2 process 'myst'..."
pm2 start myst || { echo "PM2 start failed! Exiting."; exit 1; }

echo "Displaying PM2 logs..."
pm2 logs
