#!/bin/bash
# Restore NFC configuration after prebuild

echo "Restoring NFC configuration..."

# Restore aid_list.xml
mkdir -p android/app/src/main/res/xml
cp .android-backup/res/xml/aid_list.xml android/app/src/main/res/xml/

# Restore strings.xml (merge with existing)
cp .android-backup/res/values/strings.xml android/app/src/main/res/values/

# Restore AndroidManifest.xml NFC service
# This adds the CardService to the manifest
if [ -f .android-backup/AndroidManifest.xml ]; then
    # Extract the service section from backup
    echo "Adding NFC CardService to AndroidManifest.xml..."
    
    # Add the service before closing </application> tag
    SERVICE='    <service android:name="com.reactnativehce.services.CardService" android:exported="true" android:permission="android.permission.BIND_NFC_SERVICE">\n      <intent-filter>\n        <action android:name="android.nfc.cardemulation.action.HOST_APDU_SERVICE"/>\n      </intent-filter>\n      <meta-data android:name="android.nfc.cardemulation.host_apdu_service" android:resource="@xml/aid_list"/>\
n    </service>'
    
    # Check if service already exists
    if grep -q "com.reactnativehce.services.CardService" android/app/src/main/AndroidManifest.xml; then
        echo "✓ NFC CardService already exists"
    else
        sed -i.bak "s|</application>|$SERVICE\n  </application>|" android/app/src/main/AndroidManifest.xml
        echo "✓ Added NFC CardService"
    fi
fi

# Add NFC permissions if not present
MANIFEST="android/app/src/main/AndroidManifest.xml"
if ! grep -q "android.permission.NFC" "$MANIFEST"; then
    echo "Adding NFC permissions..."
    sed -i.bak '/<manifest/a\
  <uses-permission android:name="android.permission.NFC"/>\
  <uses-feature android:name="android.hardware.nfc.hce" android:required="true"/>' "$MANIFEST"
    echo "✓ Added NFC permissions"
else
    echo "✓ NFC permissions already exist"
fi

echo "✅ NFC configuration restored!"
echo "You may need to verify the AndroidManifest.xml manually"
