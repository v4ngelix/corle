import { useRef } from 'react'
import { formatDate } from '../surveyDate'

export function SurveyDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const openPicker = () => {
    if (navigator.userActivation && !navigator.userActivation.isActive) return
    pickerRef.current?.showPicker?.()
  }

  return (
    <label className="drawings-field">
      Mõõdistamise kuupäev
      <span className="drawings-date">
        <input
          type="text"
          readOnly
          value={formatDate(value)}
          placeholder="pp.kk.aaaa"
          onFocus={openPicker}
          onClick={openPicker}
          aria-label="Mõõdistamise kuupäev"
        />
        <input
          ref={pickerRef}
          className="drawings-date-picker"
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
        />
        {value && (
          <button type="button" className="drawings-date-clear" aria-label="Eemalda mõõdistamise kuupäev" onClick={() => onChange('')}>
            ×
          </button>
        )}
      </span>
    </label>
  )
}
