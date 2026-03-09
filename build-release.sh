#!/bin/bash
# Build Release APK/AAB for Echo Mobile

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default build type
BUILD_TYPE="${1:-apk}"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  🚀 Echo Mobile - Release Build"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if we're in the right directory
if [ ! -d "android" ]; then
    echo -e "${RED}❌ Error: android directory not found${NC}"
    echo "Please run this script from the project root"
    exit 1
fi

# Verify keystore exists
if [ ! -f "android/app/echo-release.keystore" ]; then
    echo -e "${RED}❌ Error: Release keystore not found${NC}"
    echo "Expected: android/app/echo-release.keystore"
    exit 1
fi

echo -e "${BLUE}🔑 Keystore: ${GREEN}✓ Found${NC}"
echo -e "${BLUE}📦 Build Type: ${GREEN}${BUILD_TYPE}${NC}"
echo ""

# Build based on type
if [ "$BUILD_TYPE" == "aab" ]; then
    echo -e "${YELLOW}🔨 Building Release AAB (Android App Bundle)...${NC}"
    echo ""
    cd android && ./gradlew bundleRelease --console=plain
    BUILD_OUTPUT="android/app/build/outputs/bundle/release/app-release.aab"
else
    echo -e "${YELLOW}🔨 Building Release APK...${NC}"
    echo ""
    cd android && ./gradlew assembleRelease --console=plain
    BUILD_OUTPUT="android/app/build/outputs/apk/release/app-release.apk"
fi

# Check if build succeeded
if [ $? -eq 0 ]; then
    cd ..
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo -e "${GREEN}✅ Build Successful!${NC}"
    echo "═══════════════════════════════════════════════════"
    echo ""
    
    if [ -f "$BUILD_OUTPUT" ]; then
        # Display file info
        echo -e "${BLUE}📦 Output:${NC}"
        ls -lh "$BUILD_OUTPUT"
        echo ""
        
        # Show file size in MB
        SIZE=$(du -h "$BUILD_OUTPUT" | cut -f1)
        echo -e "${BLUE}📊 Size:${NC} $SIZE"
        
        # Get version info from gradle
        VERSION=$(grep "versionName" android/app/build.gradle | head -1 | sed 's/.*"\(.*\)".*/\1/')
        if [ ! -z "$VERSION" ]; then
            echo -e "${BLUE}🏷️  Version:${NC} $VERSION"
        fi
        echo ""
        
        # Copy to releases folder
        if [ ! -d "releases" ]; then
            mkdir -p releases
        fi
        
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        if [ "$BUILD_TYPE" == "aab" ]; then
            RELEASE_FILE="releases/echo-mobile-v${VERSION:-unknown}-${TIMESTAMP}.aab"
            cp "$BUILD_OUTPUT" "$RELEASE_FILE"
            echo -e "${GREEN}📁 Copied to: $RELEASE_FILE${NC}"
        else
            RELEASE_FILE="releases/echo-mobile-v${VERSION:-unknown}-${TIMESTAMP}.apk"
            cp "$BUILD_OUTPUT" "$RELEASE_FILE"
            echo -e "${GREEN}📁 Copied to: $RELEASE_FILE${NC}"
        fi
        echo ""
        
        # Installation instructions
        if [ "$BUILD_TYPE" == "apk" ]; then
            echo "═══════════════════════════════════════════════════"
            echo -e "${BLUE}📱 Installation:${NC}"
            echo "═══════════════════════════════════════════════════"
            echo ""
            echo "Install on connected device/emulator:"
            echo -e "${YELLOW}  adb install $BUILD_OUTPUT${NC}"
            echo ""
            echo "Or use:"
            echo -e "${YELLOW}  adb install $RELEASE_FILE${NC}"
            echo ""
        else
            echo "═══════════════════════════════════════════════════"
            echo -e "${BLUE}📤 Upload to Google Play:${NC}"
            echo "═══════════════════════════════════════════════════"
            echo ""
            echo "Use the AAB file for Play Store upload:"
            echo "  $RELEASE_FILE"
            echo ""
        fi
        
        # Show SHA-256 fingerprint for verification
        echo "═══════════════════════════════════════════════════"
        echo -e "${BLUE}🔐 APK SHA-256 Fingerprint:${NC}"
        echo "═══════════════════════════════════════════════════"
        if command -v keytool &> /dev/null; then
            keytool -printcert -jarfile "$BUILD_OUTPUT" 2>/dev/null | grep "SHA256:" || echo "Unable to extract certificate"
        else
            echo "keytool not found - skipping fingerprint"
        fi
        echo ""
        
    else
        echo -e "${RED}❌ Error: Build output not found at $BUILD_OUTPUT${NC}"
        exit 1
    fi
else
    echo ""
    echo "═══════════════════════════════════════════════════"
    echo -e "${RED}❌ Build Failed!${NC}"
    echo "═══════════════════════════════════════════════════"
    exit 1
fi

echo "═══════════════════════════════════════════════════"
echo -e "${GREEN}✨ Done!${NC}"
echo "═══════════════════════════════════════════════════"
echo ""
