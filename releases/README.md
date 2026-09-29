# Android test app

`128bitmaps-android-test.apk` is a debug build of 128BITMAPS for trying the app on an Android phone.
It is not for the Play Store and is signed with a throwaway debug key.

## Install on your phone

1. On the phone, open this file on GitHub (in the browser) and tap **Download** (the "..." menu, or the download icon).
2. Open the downloaded file. Android will ask to allow installs from your browser: allow it just for this.
3. Tap **Install**, then **Open**. If Play Protect warns about an unknown app, choose **Install anyway**; it's your own test build.
4. The first time you tap the find-me button or "Use my location", allow location.

## What to check

- The map loads and looks pixelated.
- Search a place, set From and To, and the route shows.
- Long-press nothing needed: tap the map, press **SAVE**, pick a building.
- **GO** drives the car. The back button closes menus first.
- Rotate the phone: everything should still fit and the map stays visible.

To rebuild it yourself: `npm run build:app`, then `cd android && ./gradlew assembleDebug`.
