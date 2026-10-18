Catan Companion
===============

A companion app for CATAN, made for phones at the game table. It makes
balanced random boards for the standard (3–4 player) and expanded (5–6
player) maps, has a short guide to the rules, and installs as an app that
works offline.

**Use it at [catanboard.pages.dev](https://catanboard.pages.dev).**

Originally made by Jared Kirschner as catan-randomizer, and rebuilt by
Ryan Gonzalez for phones.

## Features

- **Balanced boards.** Tiles, number tokens and harbors follow the official
  counts. Optional rules keep 6s and 8s apart, keep 2s and 12s apart, keep
  matching resources apart, or put the desert in the center. Each board
  gets a fairness score, and can mark the 3 strongest starting spots.
- **A deck of boards.** Swipe the board left or right to step through the
  boards you've made, or hold and slide the dots under it to scrub through
  them. Your boards are kept on the device until you clear them.
- **Sharing.** Swipe the board up for a QR code and a link to it, so
  another phone at the table can open the same board.
- **Rules.** The menu at the top opens a short, searchable version of
  the CATAN 5th edition rules, for the base game and Cities & Knights, with
  links to the official rulebooks.
- **Light and dark themes**, following the device or picked in Settings.

## Installing it on a phone

Open [catanboard.pages.dev](https://catanboard.pages.dev), then:

- **iPhone or iPad:** in Safari, tap Share, then Add to Home Screen.
- **Android:** tap Install when the app offers it, or use the browser
  menu's Install app.

## Running it locally

It's a static site with no build step. Serve the folder over HTTP (the
service worker needs it), for example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Credits

QR codes are drawn with
[QR Code Generator for JavaScript](https://github.com/kazuhikoarase/qrcode-generator)
by Kazuhiko Arase (MIT license), in `js/vendor/qrcode.js`.

CATAN is a trademark of CATAN GmbH. This project isn't affiliated with or
endorsed by CATAN GmbH or CATAN Studio.
