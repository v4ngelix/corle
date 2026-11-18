corle/
├── web/                     # React + TS + Vite + MapLibre
│   ├── src/
│   │   ├── map/             # map init, basemaps, overlay layers + styles
│   │   ├── components/      # LayerPanel, AddressSearch, ZoomLabel, LocateButton, popups
│   │   ├── admin/           # login, upload/preview, management list
│   │   ├── config.ts        # all external URLs (risk 9.2)
│   │   └── main.tsx
│   ├── index.html           # noindex meta
│   └── vite.config.ts       # dev proxy /api → server
├── server/                  # Fastify + better-sqlite3
│   ├── src/
│   │   ├── routes/          # drawings, layers, elasa, auth, uploads
│   │   ├── db/              # schema.sql, queries
│   │   ├── convert/         # ogr2ogr wrapper, CRS, axis swap, bounds, dates
│   │   ├── auth/            # scrypt, sessions, rate limit
│   │   └── index.ts         # also serves built web/dist
│   └── test/
├── shared/                  # optional: API types (Drawing, etc.) used by both
├── scripts/                 # import-drawings, import-static-layers, create-user
├── data/                    # gitignored; = Docker volume
│   ├── corle.sqlite
│   ├── uploads/
│   └── layers/              # seadustusala/5g/mastid .geojson from import script
├── Dockerfile               # multi-stage: build web + server, runtime w/ GDAL
├── docker-compose.yml       # app + caddy
├── Caddyfile
├── package.json             # npm workspaces: web, server, shared
└── tsconfig.base.json
