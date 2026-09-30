#!/bin/sh
# Renders the extension icons from the SVG sources into public/icons/.
# Needs rsvg-convert (librsvg) and ImageMagick (`magick`).
# 16/32 px use the simplified icon-small.svg for toolbar legibility.
# 128 px follows the Chrome Web Store guideline: 96x96 artwork + 16 px transparent padding.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/icons
rsvg-convert -w 16 -h 16 icons/icon-small.svg -o public/icons/icon16.png
rsvg-convert -w 32 -h 32 icons/icon-small.svg -o public/icons/icon32.png
rsvg-convert -w 48 -h 48 icons/icon.svg -o public/icons/icon48.png
rsvg-convert -w 96 -h 96 icons/icon.svg | magick - -background none -gravity center -extent 128x128 public/icons/icon128.png
echo "Icons written to public/icons/"
