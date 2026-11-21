import { LngLatBounds, type Map as MapLibreMap, type PaddingOptions } from 'maplibre-gl'
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteDrawing,
  type Drawing,
  type DrawingForm,
  listDrawings,
  saveDrawing,
  updateDrawing,
  uploadDxf,
  uploadFileUrl,
  type UploadPreview,
} from '../api'
import { DxfPreviewLayer } from '../map/DxfPreviewLayer'
import { reloadDrawings } from '../map/overlays'

type Mode =
  | { kind: 'list' }
  | { kind: 'upload'; preview: UploadPreview; selected: Set<string>; form: DrawingForm }
  | { kind: 'edit'; drawing: Drawing; form: DrawingForm }

const LOCATION_LABELS = { underground: 'Maa-alune', overhead: 'Õhuliin' }

const EMPTY_FORM: DrawingForm = { name: '', municipality: '', settlement: '', location: '', surveyor: '', surveyedOn: '' }

function formOf(d: Drawing): DrawingForm {
  return {
    name: d.name,
    municipality: d.municipality ?? '',
    settlement: d.settlement ?? '',
    location: d.location,
    surveyor: d.surveyor ?? '',
    surveyedOn: d.surveyedOn ?? '',
  }
}

const numberFormat = new Intl.NumberFormat('et-EE', { maximumFractionDigits: 1 })

function formatLength(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${numberFormat.format(m / 1000)} km`
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function ignoredText({ points, polygons, other }: UploadPreview['ignored']): string {
  const parts = [
    points && `${points} punkti/teksti`,
    polygons && `${polygons} pinda`,
    other && `${other} muud objekti`,
  ].filter(Boolean)
  return parts.length ? `Eiratud: ${parts.join(', ')}.` : ''
}

function matches(d: Drawing, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [d.name, d.municipality, d.settlement, d.surveyor, d.originalFilename].some((v) => v?.toLowerCase().includes(q))
}

function FormFields({ form, onChange }: { form: DrawingForm; onChange: (form: DrawingForm) => void }) {
  const field = (key: keyof DrawingForm, label: string, props: { type?: string; required?: boolean } = {}) => (
    <label className="drawings-field">
      {label}
      <input
        type={props.type ?? 'text'}
        required={props.required}
        value={form[key]}
        onChange={(e) => onChange({ ...form, [key]: e.target.value })}
      />
    </label>
  )
  return (
    <>
      {field('name', 'Nimi', { required: true })}
      {field('municipality', 'Omavalitsus')}
      {field('settlement', 'Asustusüksus')}
      <fieldset className="drawings-location">
        <legend>Asukoht</legend>
        {(['underground', 'overhead'] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="location"
              required
              checked={form.location === value}
              onChange={() => onChange({ ...form, location: value })}
            />
            {LOCATION_LABELS[value]}
          </label>
        ))}
      </fieldset>
      {field('surveyor', 'Mõõdistaja')}
      {field('surveyedOn', 'Mõõdistamise kuupäev', { type: 'date' })}
    </>
  )
}

/** Logged-in side panel: list, upload, edit and delete of the as-built drawings. */
export function DrawingsPanel({ map, onClose }: { map: MapLibreMap; onClose: () => void }) {
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [filter, setFilter] = useState('')
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const panelRef = useRef<HTMLElement>(null)
  const preview = useMemo(() => new DxfPreviewLayer(map), [map])

  /** Keeps fitted features out from under the panel. */
  const padding = useCallback((): PaddingOptions => {
    const rect = panelRef.current?.getBoundingClientRect()
    const base = { top: 60, bottom: 40, left: 40, right: 40 }
    if (!rect) return base
    return rect.top > window.innerHeight / 3
      ? { ...base, bottom: window.innerHeight - rect.top + 20 }
      : { ...base, right: window.innerWidth - rect.left + 20 }
  }, [])

  const load = async () => setDrawings(await listDrawings())

  useEffect(() => {
    let active = true
    listDrawings()
      .then((list) => active && setDrawings(list))
      .catch((err: Error) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [])

  const uploadPreview = mode.kind === 'upload' ? mode.preview : null
  const selected = mode.kind === 'upload' ? mode.selected : null

  useEffect(() => {
    if (!uploadPreview || !selected) return
    preview.show(uploadPreview.layers, selected)
  }, [preview, uploadPreview, selected])

  useEffect(() => {
    if (!uploadPreview) return
    preview.fit(uploadPreview.layers, new Set(), padding())
    return () => preview.clear()
  }, [preview, uploadPreview, padding])

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onFile = (file: File) =>
    run(async () => {
      const result = await uploadDxf(file)
      const name = file.name.replace(/\.dxf$/i, '')
      setMode({ kind: 'upload', preview: result, selected: new Set(), form: { ...EMPTY_FORM, name } })
    })

  const toggleLayer = (name: string) => {
    if (mode.kind !== 'upload') return
    const next = new Set(mode.selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setMode({ ...mode, selected: next })
  }

  const setForm = (form: DrawingForm) => {
    if (mode.kind !== 'list') setMode({ ...mode, form })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (mode.kind === 'list') return
    void run(async () => {
      if (mode.kind === 'upload') {
        if (mode.selected.size === 0) throw new Error('Vali vähemalt üks kiht.')
        const layers = mode.preview.layers.map((l) => l.name).filter((n) => mode.selected.has(n))
        const saved = await saveDrawing(mode.preview.uploadId, layers, mode.form)
        setNotice(`„${saved.name}“ salvestatud.`)
      } else {
        const saved = await updateDrawing(mode.drawing.id, mode.form)
        setNotice(`„${saved.name}“ muudetud.`)
      }
      setMode({ kind: 'list' })
      reloadDrawings(map)
      await load()
    })
  }

  const remove = (d: Drawing) => {
    if (!window.confirm(`Kustutada teostusjoonis „${d.name}“? Ka algne fail kustutatakse.`)) return
    void run(async () => {
      await deleteDrawing(d.id)
      setNotice(`„${d.name}“ kustutatud.`)
      reloadDrawings(map)
      await load()
    })
  }

  const zoomTo = (d: Drawing) => {
    const [w, s, e, n] = d.bbox
    map.fitBounds(new LngLatBounds([w, s], [e, n]), { padding: padding(), maxZoom: 18 })
  }

  const visible = drawings.filter((d) => matches(d, filter))
  const selectedLength =
    mode.kind === 'upload'
      ? mode.preview.layers.filter((l) => mode.selected.has(l.name)).reduce((sum, l) => sum + l.lengthM, 0)
      : 0

  return (
    <aside ref={panelRef} className="drawings-panel" aria-label="Teostusjoonised">
      <header className="drawings-header">
        <h2>
          {mode.kind === 'upload' ? 'Lisa teostusjoonis' : mode.kind === 'edit' ? 'Muuda teostusjoonist' : 'Teostusjoonised'}
        </h2>
        <button type="button" className="drawings-close" aria-label="Sulge" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="drawings-body">
        {error && <p className="upload-error">{error}</p>}
        {notice && <p className="upload-ok">{notice}</p>}

        {mode.kind === 'list' && (
          <>
            <div className="drawings-toolbar">
              <label className={`upload-button${busy ? ' is-disabled' : ''}`}>
                {busy ? 'Loen faili…' : 'Lisa teostusjoonis (DXF)'}
                <input
                  type="file"
                  accept=".dxf"
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void onFile(file)
                  }}
                />
              </label>
              <input
                type="search"
                className="drawings-filter"
                placeholder="Otsi nime, küla, valla järgi"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <p className="upload-info">
              {visible.length === drawings.length ? `${drawings.length} joonist` : `${visible.length} / ${drawings.length} joonist`}
            </p>
            <ul className="drawings-list">
              {visible.map((d) => (
                <li key={d.id}>
                  <button type="button" className="drawings-item" onClick={() => zoomTo(d)} title="Suumi joonisele">
                    <span className="upload-name">{d.name}</span>
                    <span className="upload-meta">
                      {[d.settlement, d.municipality].filter(Boolean).join(', ')}
                    </span>
                    <span className="upload-meta">
                      {[LOCATION_LABELS[d.location], d.surveyedOn && formatDate(d.surveyedOn), formatLength(d.lengthM)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </button>
                  <div className="upload-actions">
                    <button
                      type="button"
                      className="upload-button"
                      disabled={busy}
                      onClick={() => setMode({ kind: 'edit', drawing: d, form: formOf(d) })}
                    >
                      Muuda
                    </button>
                    {d.uploadId !== null && (
                      <a className="upload-button" href={uploadFileUrl(d.uploadId)} download>
                        Algne fail
                      </a>
                    )}
                    <button type="button" className="upload-button" disabled={busy} onClick={() => remove(d)}>
                      Kustuta
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {mode.kind !== 'list' && (
          <form className="drawings-form" onSubmit={submit}>
            {mode.kind === 'upload' && (
              <>
                <p className="upload-meta">{mode.preview.filename}</p>
                <fieldset className="drawings-layers">
                  <legend>Vali võrgu kihid</legend>
                  {mode.preview.layers.map((l) => (
                    <label key={l.name} className={l.inEstonia ? undefined : 'is-disabled'}>
                      <input
                        type="checkbox"
                        disabled={!l.inEstonia}
                        checked={mode.selected.has(l.name)}
                        onChange={() => toggleLayer(l.name)}
                      />
                      <span className="drawings-layer-name">{l.name}</span>
                      <span className="upload-meta">
                        {!l.inEstonia
                          ? 'väljaspool Eestit'
                          : `${l.lines} joont · ${formatLength(l.lengthM)}${l.swapped ? ' · X/Y parandatud' : ''}`}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <p className="upload-info">
                  Valitud kokku: {formatLength(selectedLength)}. {ignoredText(mode.preview.ignored)}
                </p>
                <button
                  type="button"
                  className="upload-button"
                  onClick={() => preview.fit(mode.preview.layers, mode.selected, padding())}
                >
                  Suumi valikule
                </button>
              </>
            )}
            <FormFields form={mode.form} onChange={setForm} />
            <div className="upload-actions">
              <button type="submit" className="upload-button drawings-primary" disabled={busy}>
                {busy ? 'Salvestan…' : 'Salvesta'}
              </button>
              <button
                type="button"
                className="upload-button"
                disabled={busy}
                onClick={() => {
                  setError('')
                  setMode({ kind: 'list' })
                }}
              >
                Tühista
              </button>
            </div>
          </form>
        )}
      </div>
    </aside>
  )
}
