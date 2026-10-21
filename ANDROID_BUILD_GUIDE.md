# Android APK Build & Deployment Guide — Neo Finance

## 1. Prerequisites

To compile the native Android APK (`.apk`) or Android App Bundle (`.aab`), ensure the development machine has the following tools installed:

- **Node.js**: `v18.x` or `v20.x+`
- **Java Development Kit (JDK)**: OpenJDK 17 or 21 (recommended for Gradle 8.x)
  - Verify with: `java -version`
  - Set `JAVA_HOME` environment variable (e.g., `export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home`)
- **Android SDK**: API Level 34 / 35 (Android 14 / 15)
  - Set `ANDROID_HOME` environment variable (e.g., `export ANDROID_HOME=$HOME/Library/Android/sdk`)
  - Ensure `platform-tools`, `platforms;android-34`, and `build-tools;34.0.0` are installed.
- **Android Studio** (optional, for GUI inspection and visual device emulator).

---

## 2. Architecture & Configuration

The application uses **Capacitor 8** integration with zero overhead on the existing React 18 + Vite + Tailwind CSS stack.

- **Application ID**: `com.neofinance.app`
- **Application Name**: `Neo Finance`
- **Web Assets Directory**: `dist`
- **Native Android Root**: `android/`
- **App Icons**: Configured in `android/app/src/main/res/`
  - Adaptive foreground: `drawable-v24/ic_launcher_foreground.xml` (Neo Finance geometric brand glyph with mint `#4ADE80` to indigo gradient)
  - Adaptive background: `values/ic_launcher_background.xml` & `drawable/ic_launcher_background.xml` (`#050508`)
  - Legacy launcher icons: `mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png` & `ic_launcher_round.png`
- **Splash Screen**: Native dark splash screen (`#050508`) with launch auto-hide.
- **Hardware Back Button**: Handled via `@capacitor/app` in `src/hooks/useCapacitor.ts`:
  1. Dismisses active sheets/modals first (Transaction details, Transfer, Add Account, Budget editor).
  2. Navigates back to the Home tab if on a sub-tab (Wallet, Reports, Stats).
  3. Closes application when on Home tab.
- **Status Bar**: Styled dynamically via `@capacitor/status-bar` to match Light/Dark/AMOLED themes.

---

## 3. Build Commands

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build Web Assets for Capacitor
```bash
npm run build:cap
```
*Note: Uses `BUILD_TARGET=capacitor` to generate relative `./` asset paths in `dist/` compatible with `https://localhost` or `capacitor://localhost` webviews.*

### Step 3: Synchronize Assets to Android Project
```bash
npm run cap:sync
```
*Copies the `dist/` production bundle into `android/app/src/main/assets/public` and updates native plugin registrations.*

---

## 4. Generating the APK

### Debug APK (For local device testing)
Run from the project root:
```bash
npm run cap:build:android
```
Or manually in the `android/` directory:
```bash
cd android
./gradlew assembleDebug
```
- **Output Location**: `android/app/build/outputs/apk/debug/app-debug.apk`

### Installing Debug APK via ADB
Connect an Android device with USB debugging enabled, then execute:
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 5. Release APK & AAB Signing Procedure

### Step 1: Generate a Keystore (One-time setup)
```bash
keytool -genkey -v -keystore neo-finance-release.keystore -alias neofinance -keyalg RSA -keysize 2048 -validity 10000
```
> [!CAUTION]
> Never commit `*.keystore` files or keystore passwords to version control! Keep a secure offline backup.

### Step 2: Build Unsigned Release APK or Bundle
```bash
cd android
./gradlew assembleRelease
# Or for Google Play Store:
# ./gradlew bundleRelease
```
- **Unsigned APK Output**: `android/app/build/outputs/apk/release/app-release-unsigned.apk`
- **Unsigned AAB Output**: `android/app/build/outputs/bundle/release/app-release.aab`

### Step 3: Align and Sign the Release APK
```bash
zipalign -v -p 4 android/app/build/outputs/apk/release/app-release-unsigned.apk neo-finance-release-aligned.apk

apksigner sign --ks neo-finance-release.keystore --ks-key-alias neofinance --out neo-finance-release-signed.apk neo-finance-release-aligned.apk
```

---

## 6. Running with Android Studio
If you prefer building and running through the IDE:
```bash
npm run cap:open
```
1. Android Studio will open the `android/` project.
2. Allow Gradle sync to complete.
3. Select an emulator or connected physical device and click **Run** (`Shift + F10`).
