import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fromKpo, lineLength, tallinnDate } from '../src/kpo.ts'

const kpo = {
  KPO_NIMI: 'CORLE sidevõrk',
  MOODISTAJA: 'OÜ Kagu Geodeesia',
  MOODISTUSE_KPV: '2024-09-30T21:00:00.000Z',
  OIGUSLIK_KPV: null,
  ASUKOHT: 'KPO_ASUKOHT_MAA_ALUNE',
  VALINE_ID: 'Lääne-Nigula vald//Oonga küla//Oonga_CO5693//03.06.2025',
  TAPSUSKLASS: 0.1,
  SEISUND: 'KPO_SEISUND_KEHTIV',
  layer: 'Teostus_MA_MKM',
  path: 'C:/qgis-server_Projektid/Teostused_MA_OK - Copy.gpkg|layername=Teostus_MA_MKM',
}

test('fromKpo maps the KPO attributes to columns', () => {
  assert.deepEqual(fromKpo(kpo), {
    name: 'Oonga_CO5693',
    municipality: 'Lääne-Nigula vald',
    settlement: 'Oonga küla',
    location: 'underground',
    surveyor: 'OÜ Kagu Geodeesia',
    surveyedOn: '2024-10-01',
    accuracyClass: 0.1,
    attrs: {
      KPO_NIMI: 'CORLE sidevõrk',
      VALINE_ID: 'Lääne-Nigula vald//Oonga küla//Oonga_CO5693//03.06.2025',
      SEISUND: 'KPO_SEISUND_KEHTIV',
    },
  })
})

test('fromKpo maps overhead and drops the ÕHK part of the name', () => {
  const d = fromKpo({
    ...kpo,
    ASUKOHT: 'KPO_ASUKOHT_MAAPEALNE',
    VALINE_ID: 'Harku vald//Muraste küla//Muraste_CO5038//ÕHK//30.07.2025',
  })
  assert.equal(d.location, 'overhead')
  assert.equal(d.name, 'Muraste_CO5038')
  assert.equal(d.settlement, 'Muraste küla')
})

test('fromKpo keeps missing surveyor, date and accuracy as null', () => {
  const d = fromKpo({ ...kpo, MOODISTAJA: null, MOODISTUSE_KPV: null, TAPSUSKLASS: null })
  assert.equal(d.surveyor, null)
  assert.equal(d.surveyedOn, null)
  assert.equal(d.accuracyClass, null)
})

test('fromKpo rejects an unknown ASUKOHT', () => {
  assert.throws(() => fromKpo({ ...kpo, ASUKOHT: 'KPO_ASUKOHT_VEES' }), /ASUKOHT/)
})

test('fromKpo rejects a VALINE_ID without municipality, settlement and name', () => {
  assert.throws(() => fromKpo({ ...kpo, VALINE_ID: 'Oonga_CO5693' }), /VALINE_ID/)
})

test('tallinnDate converts UTC timestamps to the Tallinn calendar date', () => {
  assert.equal(tallinnDate('2024-09-30T21:00:00.000Z'), '2024-10-01')
  assert.equal(tallinnDate('2025-11-03T22:00:00.000Z'), '2025-11-04')
  assert.equal(tallinnDate('2024-12-20T00:00:00.000Z'), '2024-12-20')
})

test('lineLength sums planar segment lengths', () => {
  const line = { type: 'LineString' as const, coordinates: [[0, 0], [3, 4], [3, 10]] }
  assert.equal(lineLength(line), 11)
  const multi = { type: 'MultiLineString' as const, coordinates: [line.coordinates, [[0, 0], [0, 2]]] }
  assert.equal(lineLength(multi), 13)
})
