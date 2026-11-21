import express from 'express'

export function layers(dir: string) {
  return express.static(dir, { index: false })
}
