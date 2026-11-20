import type { Map as MapLibreMap } from 'maplibre-gl'
import type { KeyboardEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ADDRESS_SEARCH } from '../config'
import { SearchResultLayer } from '../map/SearchResultLayer'
import { searchAddresses } from './addressSearchApi'
import type { AddressSuggestion } from './addressSearchApi'

function highlightMatch(label: string, query: string): ReactNode[] {
  const words = query.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 1)
  const lower = label.toLowerCase()
  const nodes: ReactNode[] = []
  let plain = ''
  let i = 0

  while (i < label.length) {
    const word = words.find((w) => lower.startsWith(w, i))
    if (word) {
      if (plain) nodes.push(plain)
      plain = ''
      nodes.push(<span key={i} className="search-match">{label.slice(i, i + word.length)}</span>)
      i += word.length
    } else {
      plain += label[i]
      i += 1
    }
  }
  if (plain) nodes.push(plain)
  return nodes
}

export function AddressSearch({ map }: { map: MapLibreMap | null }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [suggestionsQuery, setSuggestionsQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const requestRef = useRef<AbortController>(null)

  const resultLayer = useMemo(() => (map ? new SearchResultLayer(map) : null), [map])

  useEffect(() => () => {
    clearTimeout(timerRef.current)
    requestRef.current?.abort()
  }, [])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function cancelPending() {
    clearTimeout(timerRef.current)
    requestRef.current?.abort()
    setBusy(false)
  }

  function closeList() {
    setOpen(false)
    setActiveIndex(-1)
  }

  function resetList() {
    closeList()
    setSuggestions([])
    setSuggestionsQuery('')
  }

  async function runSearch(query: string) {
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const results = await searchAddresses(query, controller.signal)
      setSuggestions(results)
      setSuggestionsQuery(query)
      setActiveIndex(-1)
      setOpen(true)
    } catch (error) {
      if ((error as Error).name === 'AbortError') return
      resetList()
      console.error('Aadressiotsing ebaõnnestus', error)
    }
    setBusy(false)
  }

  function handleChange(next: string) {
    setValue(next)
    cancelPending()
    const query = next.trim()
    if (query.length < ADDRESS_SEARCH.minLength) {
      resetList()
      return
    }
    setBusy(true)
    timerRef.current = setTimeout(() => runSearch(query), ADDRESS_SEARCH.debounceMs)
  }

  function select(suggestion: AddressSuggestion) {
    closeList()
    setValue(suggestion.label)
    resultLayer?.show(suggestion)
  }

  function clear() {
    cancelPending()
    resetList()
    setValue('')
    resultLayer?.clear()
    inputRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!suggestions.length) return
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setOpen(true)
      setActiveIndex((i) => (i + step + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const suggestion = suggestions[Math.max(activeIndex, 0)]
      if (suggestion) select(suggestion)
    } else if (event.key === 'Escape') {
      closeList()
    }
  }

  function reopen() {
    if (!open && suggestions.length && value.trim() === suggestionsQuery) setOpen(true)
  }

  return (
    <div className="search">
      <div className="search-box">
        <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="9" cy="9" r="6" />
          <line x1="13.5" y1="13.5" x2="18" y2="18" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={value}
          title={value || undefined}
          placeholder="Otsi aadressi"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="search-results"
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={closeList}
          onClick={reopen}
        />
        <div className="search-slot">
          {busy && <div className="search-spinner" />}
          {!busy && value && (
            <button className="search-clear" type="button" aria-label="Tühjenda otsing" onClick={clear}>
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <line x1="5" y1="5" x2="15" y2="15" />
                <line x1="15" y1="5" x2="5" y2="15" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {open && (
        <ul ref={listRef} id="search-results" className="search-results" role="listbox">
          {suggestions.length === 0 && <li className="search-empty">Tulemusi ei leitud</li>}
          {suggestions.map((s, i) => (
            <li
              key={`${s.label}-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === activeIndex}
              className={i === activeIndex ? 'is-active' : undefined}
              title={s.label}
              onMouseDown={(e) => {
                e.preventDefault()
                select(s)
              }}
            >
              {highlightMatch(s.label, suggestionsQuery)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
