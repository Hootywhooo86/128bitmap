# Android test app

`128bitmaps-android-test.apk` is a test build of 128BITMAPS for trying the app on an Android phone.
It is not for the Play Store and is signed with a throwaway debug key.

## Install on your phone

1. On the phone, open this file on GitHub in the browser and download it (raw file link, or the download icon).
2. Open the downloaded file. Android will ask to allow installs from your browser: allow it just for this.
3. Tap **Install**, then **Open**. If Play Protect warns about an unknown app, choose **Install anyway**; it's your own test build.
4. Allow location when it asks. The map opens on where you are.

## What to check

- The map loads and looks like a normal maps app.
- Type where you are going in **To**, tap **USE MY LOCATION AS START**, then **START**. Walk or drive a little: the banner should show the next turn and the distance to it, and it should speak.
- Go a different way from the route: it should say "Rerouting" and find a new one.
- Try **Walk** and **Bike**, and turn the phone sideways.
- **MENU → LOOK → Retro** switches to the pixel look.
- The back button closes menus first, and only then leaves the app.

Guidance works while the app is open with the screen on. It does not yet navigate with the screen off.

To rebuild it yourself: `npm run build:app`, then `cd android && ./gradlew assembleDebug`.
