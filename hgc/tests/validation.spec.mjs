import { describe, test, expect } from 'vitest'
import * as h3 from 'h3-js'
import { validateSample } from '../src/utils/validation.js'

describe('validation utilities', () => {
  test('validateSample checks geoCellId and sensor limits', () => {
    const cell = h3.latLngToCell(0, 0, 8)
    expect(validateSample({ geoCellId: cell, pm25: 10 })).toEqual([])
    expect(validateSample({ geoCellId: 'bad' })).toHaveLength(1)
    const errors = validateSample({ geoCellId: cell, pm25: -1 })
    expect(errors[0]).toMatch(/pm25/)
  })
})

