# 128BITMAPS

A from → to map app drawn in chunky retro pixel art. Real streets, real directions, 16-bit style.
Save your own places as tiny animated pixel buildings (the gym is a dungeon, work is a prison, home is a castle) and watch a pixel car drive your route.

![Route on desktop](docs/desktop-route.png)

## What it does

- **Pixel-art map of the real world.** OpenStreetMap data drawn in a small retro palette at 1/3 resolution and scaled up without smoothing, so every street turns into chunky pixels. Names are drawn on a separate sharp layer so they stay readable.
- **From / To directions.** Search as you type, tap the map to drop a pin, or use your location. The route pulses like an old-school game path, with time, distance and tappable turn-by-turn steps.
- **Your places, as buildings.** Tap the map (or search, or use the ★ in the From/To boxes), name the spot and pick one of **50 animated pixel buildings** on 10 shelves. The building shows on the map, and a name like "Planet Fitness" or "Grandma's house" suggests a fitting one. Edit, move (tap the map while editing) and delete places any time. Saved places also show up in the From/To boxes for one-tap trips.
- **A garage of 10 pixel cars** and a **GO ▶** button: the car drives your route, the camera follows it, and it tilts up and down hills.
- **Backup and restore.** Save your places and car to a file and restore them on another phone. Restoring only adds, it never deletes.
- **Works everywhere.** Laptops, phones held upright, phones held sideways. Every menu is a side panel, a bottom sheet or a side column so the map is always visible.
- **Works as a real app.** Installable from the browser, and wrapped for Android and iPhone with Capacitor.

### The 50 buildings

| Shelf | Buildings |
|---|---|
| Homes | Castle, Cottage, Treehouse, Igloo, Wizard Tower |
| Work | Prison, Factory, Office Tower, Mine, Lab |
| Fitness | Dungeon, Arena, Dojo, Boxing Ring, Climbing Peak |
| Food | Tavern, Pizza Cave, Potion Bar, Food Truck, Candy House |
| Shops | Market Stall, Treasure Vault, Blacksmith, Bazaar, Arcade |
| School | Library, Academy, Observatory, Schoolhouse, Kindergarten |
| Health | Healing Temple, Hospital, Herb Hut, Pharmacy, Hot Spring |
| Fun | Haunted House, Ferris Wheel, Pirate Ship, Stadium, Theater |
| Travel | Airship Dock, Train Station, Pit Stop, Lighthouse, Motel |
| Family | Fort, Log Cabin, Farm, Campsite, Party House |

Cars: Muscle, Taxi, Van, Monster, Go-Kart, Delivery, Hover, Bus, Sports, Pickup.

Every building and car is drawn in code (`src/pixel/`), so there are no image files to manage and adding one is a few lines. To look at them all, run `npm run dev` and open `/?sprites`.

## Run it

```sh
npm install
npm run dev      # open the printed link
npm run build    # production build into dist/
```

## Put it online (GitHub Pages)

The workflow in `.github/workflows/pages.yml` publishes the site whenever `main` changes.

1. Merge this work into `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push (or run the workflow from the Actions tab). The site appears at `https://<your-user>.github.io/128bitmap/`.

On a phone, open that link and use **Add to Home Screen** for a full-screen app straight away.

## Android and iPhone apps

The web app is wrapped with [Capacitor](https://capacitorjs.com): `android/` and `ios/` are ready-made native projects that load the same code.

After changing the web app, sync it into both projects:

```sh
npm run build:app
```

### Android

```sh
npm run android          # opens Android Studio; press Run to try it on a phone or emulator
cd android && ./gradlew assembleDebug    # or build an installable test file
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

To publish on Google Play you need a [Play Console](https://play.google.com/console) account (one-time US$25) and a signed release build (Android Studio: *Build → Generate Signed App Bundle*).

### iPhone

iPhone apps can only be built on a Mac with Xcode.

```sh
npm run ios              # opens Xcode; pick your iPhone and press Run
```

To publish on the App Store you need an [Apple Developer](https://developer.apple.com/programs/) account (US$99 a year). Apple reviews every app before it goes live. If you don't have a Mac, a cloud build service (for example Ionic Appflow or Codemagic) can build the iPhone app for you.

### Before you publish

- **App ID.** `app.bitmaps128.map` in `capacitor.config.ts` is the app's permanent store ID. Change it before the first release; it can't change afterwards.
- **Search and routes.** The free public Photon (search) and OSRM (directions) servers are fine for personal use. For a public launch, switch to a routing/search service with its own API key (see `src/lib/geo.ts`).
- **Map tiles.** OpenFreeMap is free and needs no key. Keep the OpenStreetMap credit visible.

## Built with

React + TypeScript + Vite, [MapLibre GL](https://maplibre.org/) for the map, free map data from [OpenFreeMap](https://openfreemap.org), search from [Photon](https://photon.komoot.io), routes from the public [OSRM](https://project-osrm.org) server, and [Capacitor](https://capacitorjs.com) for the phone apps. Fonts: Press Start 2P and VT323 (SIL Open Font License), bundled. Map data © OpenStreetMap contributors.

## Roadmap

1. ~~Pixel map + From/To directions~~
2. ~~Save places with pixel buildings~~
3. ~~Pixel cars and the drive animation~~
4. ~~All 50 animated buildings~~
5. ~~Backup/restore, install as an app, Android and iPhone projects~~
6. Next ideas: sign-in to sync places between devices, sharing a place with a friend, more buildings and cars, sound effects
