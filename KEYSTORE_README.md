# Keystore Configuration

## Release Keystore Details

**Location:** `android/app/echo-release.keystore`

**Configuration (in `android/gradle.properties`):**

```properties
ECHO_RELEASE_STORE_FILE=echo-release.keystore
ECHO_RELEASE_KEY_ALIAS=echo-key
ECHO_RELEASE_STORE_PASSWORD=echoRelease2026
ECHO_RELEASE_KEY_PASSWORD=echoRelease2026
```

## Building Release APK

### Option 1: Using the build script (Recommended)

**Build APK:**

```bash
./build-release.sh
# or explicitly
./build-release.sh apk
```

**Build AAB (for Google Play):**

```bash
./build-release.sh aab
```

The script will:

- ✓ Verify keystore exists
- ✓ Build the release version
- ✓ Show file size and version info
- ✓ Copy to `releases/` folder with timestamp
- ✓ Display installation instructions
- ✓ Show APK SHA-256 fingerprint

### Option 2: Manual build

**APK:**

```bash
cd android
./gradlew assembleRelease
```

**AAB:**

```bash
cd android
./gradlew bundleRelease
```

The release APK will be located at:

```
android/app/build/outputs/apk/release/app-release.apk
```

## Building Release AAB (for Google Play)

See Option 1 above, or manually:

```bash
cd android
./gradlew bundleRelease
```

The release AAB will be located at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

## Security Notes

⚠️ **IMPORTANT:**

- The keystore file (`echo-release.keystore`) is excluded from git
- In production, store passwords in environment variables or a secure vault
- **Never commit keystore passwords to the repository**
- Back up your keystore file securely - you cannot update your app without it!

## Keystore Backup

**Make sure to backup your keystore file!**

Recommended: Store it in a secure location like:

- Password manager
- Encrypted cloud storage
- Private vault

Loss of the keystore means you cannot update your app in the store!

## Regenerating Keystore (if needed)

To generate a new keystore:

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore echo-release.keystore \
  -alias echo-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "YOUR_STORE_PASSWORD" \
  -keypass "YOUR_KEY_PASSWORD" \
  -dname "CN=Echo Mobile, OU=Mobile, O=Xelabyte, L=City, ST=State, C=US"
```

## Viewing Keystore Info

```bash
keytool -list -v -keystore android/app/echo-release.keystore -storepass echoRelease2026
```
