#!/usr/bin/env bash
# Builds data/layers/static.pmtiles (Seadustusala, 5G, Mastid) from the GeoPackages in data/source/.
# Geometry only: the old app never exposed the attributes, so neither does this file.
# Re-run after replacing any of the source files.
set -euo pipefail

data="$(dirname "$0")/../data"
src="$data/source"
out="$data/layers/static.pmtiles"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# One GeoPackage with all three layers, so they end up in one PMTiles file as separate source-layers.
ogr2ogr -f GPKG "$tmp/static.gpkg" "$src/Seadustusala.gpkg" -nln seadustusala -select ''
ogr2ogr -update "$tmp/static.gpkg" "$src/5G.gpkg" -nln 5g -select ''
ogr2ogr -update "$tmp/static.gpkg" "$src/mastid.gpkg" -nln mastid -select ''

mkdir -p "$(dirname "$out")"
rm -f "$out"
ogr2ogr -f PMTiles "$out" "$tmp/static.gpkg" -dsco MINZOOM=0 -dsco MAXZOOM=15
echo "Wrote $out ($(du -h "$out" | cut -f1))"
