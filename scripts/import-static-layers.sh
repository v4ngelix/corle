#!/usr/bin/env bash
# Builds $DATA_DIR/layers/static.pmtiles (Seadustusala, 5G, Mastid) from the GeoPackages in $DATA_DIR/source/.
# Geometry only: the old app never exposed the attributes, so neither does this file.
# Re-run after replacing any of the source files; the backend runs it after each layer upload.
set -euo pipefail

data="${DATA_DIR:-$(dirname "$0")/../data}"
src="$data/source"
out="$data/layers/static.pmtiles"
# Dotfile next to the output: express.static doesn't serve it, and the final mv is atomic.
partial="$data/layers/.static.partial.pmtiles"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"; rm -f "$partial"' EXIT

# One GeoPackage with all three layers, so they end up in one PMTiles file as separate source-layers.
ogr2ogr -f GPKG "$tmp/static.gpkg" "$src/seadustusala.gpkg" -nln seadustusala -select ''
ogr2ogr -update "$tmp/static.gpkg" "$src/5g.gpkg" -nln 5g -select ''
ogr2ogr -update "$tmp/static.gpkg" "$src/mastid.gpkg" -nln mastid -select ''

mkdir -p "$(dirname "$out")"
rm -f "$partial"
ogr2ogr -f PMTiles "$partial" "$tmp/static.gpkg" -dsco MINZOOM=0 -dsco MAXZOOM=15
mv -f "$partial" "$out"
echo "Wrote $out ($(du -h "$out" | cut -f1))"
