import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('survey date shows Estonian format while keeping a native picker with ISO value', async () => {
  const vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { SurveyDateField } = await vite.ssrLoadModule('/src/components/SurveyDateField.tsx')
    const html = renderToStaticMarkup(React.createElement(SurveyDateField, { value: '2025-06-03', onChange() {} }))
    assert.match(html, /type="text"[^>]*value="03\.06\.2025"/)
    assert.match(html, /type="date"[^>]*value="2025-06-03"/)
    assert.match(html, /aria-label="Eemalda mõõdistamise kuupäev"/)
    const empty = renderToStaticMarkup(React.createElement(SurveyDateField, { value: '', onChange() {} }))
    assert.match(empty, /placeholder="pp\.kk\.aaaa"/)
    assert.doesNotMatch(empty, /Eemalda mõõdistamise kuupäev/)
  } finally {
    await vite.close()
  }
})
