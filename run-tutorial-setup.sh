#!/bin/bash
set -e

# Define colors for better output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variable to store the PID of the concurrently process
NPM_START_PID=0

# --- Cleanup function ---
cleanup() {
  echo -e "${YELLOW}🧹 Ensuring no old demo processes are running...${NC}"
  # Kill the main concurrently process if it's still running
  if [ "$NPM_START_PID" -ne 0 ]; then
    kill "$NPM_START_PID" 2>/dev/null || true
    wait "$NPM_START_PID" 2>/dev/null || true # Wait for the process to terminate
  fi
  # Fallback: Kill any remaining vite or electron processes
  pkill -f "vite|electron" 2>/dev/null || true
  echo -e "${GREEN}✅ Cleanup complete.${NC}"
}

# Ensure cleanup runs on exit
trap cleanup EXIT

echo -e "${YELLOW}--- Starting Factory React Demo Setup ---${NC}"

# --- Step 1: Initial Cleanup ---
cleanup

# --- Step 2: Install dependencies ---
echo -e "${YELLOW}📦 Installing dependencies (this may take a moment)...${NC}"
npm install --silent
echo -e "${GREEN}✅ Dependencies installed.${NC}"

# --- Step 3: Launch the demo (Vite + Electron) ---
echo -e "${YELLOW}🚀 Launching Factory React Demo (Vite + Electron)...${NC}"

# Start the app in the background using the 'start' script defined in package.json
# This script uses 'concurrently' to manage Vite and Electron
npm run start &
NPM_START_PID=$! # Store the PID of the concurrently process

# Wait for Vite server to be ready (port 5174)
echo -e "${YELLOW}⏳ Waiting for the demo application to become responsive...${NC}"
TIMEOUT=30 # seconds
for i in $(seq 1 $TIMEOUT); do
  if curl -s http://localhost:5174 > /dev/null; then
    echo -e "${GREEN}🌐 Demo application is responsive!${NC}"
    break
  fi
  sleep 1
  if [ $i -eq $TIMEOUT ]; then
    echo -e "${RED}❌ Demo application did not become responsive within ${TIMEOUT} seconds.${NC}"
    exit 1
  fi
done

echo -e "${GREEN}✅ Factory React Demo is now running!${NC}"
echo -e "${YELLOW}💡 An Electron window should now be visible. Enjoy the demo!${NC}"

# Give some time for Electron to fully render and for visual confirmation
sleep 5

echo -e "${GREEN}--- Factory React Demo is running in the background ---${NC}"
echo -e "${YELLOW}To stop the demo, you can close the Electron window or run: pkill -f \"vite|electron\"${NC}"

# The script will now keep running until the user manually stops it or the trap is triggered.
# This is important because the user wants the app to stay running after the script finishes its setup.
# The trap will ensure cleanup happens when the script process itself is terminated.
# No explicit `exit 0` here, as the script should remain active to keep the background processes alive.
# The user will terminate the script (e.g., Ctrl+C), which will trigger the trap.

# --- Keep the script alive ---
# Wait indefinitely for the concurrently process (which manages Vite and Electron).
# This blocks the script from exiting, so the cleanup trap only runs when the user
# interrupts (Ctrl+C) or when the concurrently process naturally exits.
wait "$NPM_START_PID"
