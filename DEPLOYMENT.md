# Touround CRM Mobile - Google Play Deployment

## Prerequisites

- EAS CLI: `npm install -g eas-cli`
- Expo account: https://expo.dev
- Google Play Console: https://play.google.com/console

---

## Step 1: Verify the bundle locally

```bash
npx expo export --platform android
```

If this succeeds with no errors, your code is ready for build.

---

## Step 2: Build production AAB

```bash
set EAS_NO_VCS=1
eas build --platform android --profile production
```

Wait 5-15 minutes. Copy the download link when done.

---

## Step 3: Download the .aab file

Click the EAS download link or check recent builds:
```bash
set EAS_NO_VCS=1
eas build:list --platform android --limit 1
```

---

## Step 4: Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select **Touround for Business**
3. Go to **Release** > **Testing** > **Internal testing**
4. Click **Create new release**
5. Click **Upload** and select your `.aab` file
6. Add release notes (e.g., "v1.0.0 - Initial release")
7. Click **Save** > **Review release** > **Start rollout**

---

## Step 5: Complete store listing

Before promoting to production, fill in:

| Requirement | Location |
|-------------|----------|
| App name & descriptions | Grow > Store presence > Main store listing |
| Screenshots (min 2 phone) | Grow > Store presence > Main store listing |
| App icon (512x512 PNG) | Grow > Store presence > Main store listing |
| Feature graphic (1024x500) | Grow > Store presence > Main store listing |
| Content rating | Policy > App content > Content rating |
| Target audience | Policy > App content > Target audience |
| Data safety | Policy > App content > Data safety |
| Privacy policy URL | Policy > App content > Privacy policy |
| App category | Set to "Business" |
| Contact email | Required for store listing |

---

## Step 6: Promote to production

1. Go to **Release** > **Testing** > **Internal testing**
2. Click **Promote release** > **Production**
3. Review and confirm
4. Wait for Google's review (1-3 days first time)

---

## For future updates

### Full rebuild (native changes):
```bash
set EAS_NO_VCS=1
eas build --platform android --profile production
```
Download .aab > Upload to Play Console > Create new release > Rollout

### OTA update (JS-only changes, no rebuild):
```bash
set EAS_NO_VCS=1
eas update --branch production --message "Description of changes"
```

---

## Testing builds

### Preview APK (for emulator/device testing):
```bash
set EAS_NO_VCS=1
eas build --platform android --profile preview
```

### Run on emulator:
```bash
set EAS_NO_VCS=1
eas build:run --platform android --latest
```

---

## App Configuration

- **Package name:** `com.touround.touround_crm`
- **Production API:** `https://touround-qa-fbee698b7067.herokuapp.com/api`
- **Dev API (Android emulator):** `http://10.0.2.2:8081/api`
- **Dev API (iOS simulator):** `http://localhost:8081/api`

---

## Checklist before submission

- [ ] App icon saved as transparent PNG (512x512+)
- [ ] Splash icon saved as transparent PNG
- [ ] No `@expo/vector-icons` or `MaterialIcons` imports
- [ ] No `expo-sharing` or `expo-status-bar` in plugins
- [ ] `npx expo export --platform android` succeeds
- [ ] `loginType: "BUSINESS"` in auth service
- [ ] Production API URL correct in `src/config/env.js`
- [ ] `versionCode` auto-increments via EAS
