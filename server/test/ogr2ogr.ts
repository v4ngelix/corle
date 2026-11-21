import gdal from 'gdal-async'

export function ogr2ogr(dst: string, src: string, args: string[], update = false): void {
  const source = gdal.open(src)
  try {
    const target = update ? gdal.open(dst, 'r+') : dst
    gdal.vectorTranslate(target, source, update ? args : ['-f', 'GPKG', ...args]).close()
  } finally {
    source.close()
  }
}
