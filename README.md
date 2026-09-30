# 128BITMAPS

A maps app. Pick point A and point B and it guides you there, turn by turn, using your real position, with spoken directions.
It looks like a normal maps app by default. If you like, there is an optional **Retro** look: a pixel-art map, tiny animated buildings for your saved places, and a car you can watch drive your route.

| Choose A and B | Guided, turn by turn | Off route? It re-routes |
|---|---|---|
| ![Route preview](docs/classic-route.png) | ![Navigating](docs/classic-navigating.png) | ![Rerouting](docs/classic-rerouting.png) |

| Places and detail | Tap a place | Satellite |
|---|---|---|
| ![Places](docs/classic-places.png) | ![Place card](docs/classic-place-card.png) | ![Satellite](docs/classic-satellite.png) |

## What it does

- **Directions from A to B.** Search as you type, tap the map to drop a pin, or use your location. Choose **Drive, Walk or Bike**. You get the time, distance and a list of steps.
- **Real guidance while you move.** Press **START** and it follows your GPS position: a big banner shows the next turn and how far away it is, with a "then" preview, the time you'll arrive and how much is left. The map turns to face the way you're heading. Drag the map to look around and tap **RECENTER** to snap back.
- **Voice directions.** It says each turn out loud ("In 500 feet, turn left onto 87 Avenue"). Turn it off from the speaker button or the menu.
- **Re-routes when you miss a turn.** If you leave the route it says "Rerouting…" and finds a new way from where you are.
- **A detailed map.** Shops, restaurants, cafes, clinics, parking, bus and train stops, parks and landmarks show up with icons and names as you zoom in, with footprints and 3D buildings up close. **Tap any place** to select it, then set it as From or To. A **satellite** button (the layers button) switches to real imagery with readable names.
- **Saved places.** Tap the map (or search) and press **SAVE**, for example Home, Work or the gym. Saved places show up when you type in From or To.
- **Backup and restore** your places as a file, to move them to another phone.
- **Opens where you are** the first time, like any maps app.
- **Works on laptops and phones**, upright or sideways. Menus are a side panel, a bottom sheet or a side column so the map is always visible.
- **Installs like an app.** Add it to your home screen from the browser, or use the Android/iPhone projects below.

### Retro look (optional)

Open **MENU → LOOK → Retro** to switch. You get the pixel-art map, a pulsing route, and:

- **50 animated pixel buildings** for your saved places, on 10 shelves (the gym as a dungeon, work as a prison, home as a castle, and 47 more). A name like "Planet Fitness" or "Grandma's house" suggests a fitting one.
- **10 pixel cars** and a **CAR ▶** button that drives a cartoon car along your route (a preview, separate from real guidance).

Everything in the retro look is drawn in code (`src/pixel/`), so there are no image files to manage. To see all of it, run `npm run dev` and open `/?sprites`.

![Retro buildings and cars](docs/retro/buildings-and-cars.gif)

## What it doesn't do yet

Be aware, this is a personal-scale app built on free services:

- **No live traffic**, no lane guidance and no public transit directions.
- **Guidance needs the app open with the screen on.** It asks the phone to keep the screen awake. It doesn't navigate in the background yet.
- **Needs an internet connection** for the map, search and routes (there are no offline maps).
- Walking and cycling routes come from a free community server, and routes for a big trip can take a moment.

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

The web app is wrapped with [Capacitor](https://capacitorjs.com): `android/` and `ios/` are native projects that load the same code, using the phone's own location and voice.

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

A ready-made test build is in [`releases/`](releases/README.md). To publish on Google Play you need a [Play Console](https://play.google.com/console) account (one-time US$25) and a signed release build (Android Studio: *Build → Generate Signed App Bundle*).

### iPhone

iPhone apps can only be built on a Mac with Xcode.

```sh
npm run ios              # opens Xcode; pick your iPhone and press Run
```

To publish on the App Store you need an [Apple Developer](https://developer.apple.com/programs/) account (US$99 a year). Apple reviews every app before it goes live. If you don't have a Mac, a cloud build service (for example Ionic Appflow or Codemagic) can build the iPhone app for you.

### Before you publish

- **App ID.** `app.bitmaps128.map` in `capacitor.config.ts` is the app's permanent store ID. Change it before the first release; it can't change afterwards.
- **Search and routes.** The free public Photon (search) and FOSSGIS OSRM (routes) servers are fine for personal use. For a public launch, switch to a routing/search service with its own API key (see `src/lib/geo.ts`).
- **Map tiles.** OpenFreeMap is free and needs no key. Keep the OpenStreetMap credit visible.

## Why it loads fast

The map style, its icons and the common Latin fonts ship inside the app (`public/map`, `src/map/classicStyle.json`), so the map doesn't wait on a chain of requests before it can draw; only the map tiles come from the internet. On phones the map is drawn at up to 2x (not 3x) resolution to stay smooth, and 3D buildings only appear when you're zoomed in close. The style is generated by `python3 scripts/make-classic-style.py`, which is where to change colours or how early places appear.

## How guidance works

`src/nav/Navigator.ts` follows your position, snaps it to the route near where you last were, works out the next maneuver and its distance, speaks it, and asks for a new route after a few positions away from the road. `src/nav/geometry.ts` holds the maths. Tests fed a fake GPS track along a real route, including driving off it, and checked the banner, the distance left, arrival and re-routing.

## Built with

React + TypeScript + Vite, [MapLibre GL](https://maplibre.org/) for the map, free map data from [OpenFreeMap](https://openfreemap.org), satellite imagery from Esri (attribution shown; check their terms before a public launch), search from [Photon](https://photon.komoot.io), routes from the [FOSSGIS](https://routing.openstreetmap.de) OSRM servers, and [Capacitor](https://capacitorjs.com) for the phone apps. Fonts for the retro look: Press Start 2P and VT323 (SIL Open Font License), bundled. Map data © OpenStreetMap contributors.

## Roadmap

1. ~~Map with directions from A to B~~
2. ~~Real turn-by-turn guidance, voice and re-routing~~
3. ~~Saved places, Drive/Walk/Bike, backup~~
4. ~~Optional retro look with buildings and cars~~
5. ~~Installable app, Android and iPhone projects~~
6. Next: navigation that keeps working with the screen off, live traffic, offline maps, sync places between devices, share a place with a friend
