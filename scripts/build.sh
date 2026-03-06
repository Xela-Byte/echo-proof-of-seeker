#!/bin/bash

# Quick build script - wrapper for the main build script
# Usage: ./build.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

"$SCRIPT_DIR/build-arm64.sh"
