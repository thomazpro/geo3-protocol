import * as h3 from 'h3-js'

const SENSOR_LIMITS = {
  pm25: { min: 0, max: 1000 }
}

/**
 * Validate sample format and sensor limits.
 * @param {object} sample - Sample object to validate.
 * @returns {string[]} Array of error messages, empty if valid.
 */
export function validateSample (sample) {
  const errors = []
  if (sample.geoCellId !== undefined) {
    if (typeof sample.geoCellId !== 'string' || !h3.isValidCell(sample.geoCellId)) {
      errors.push(`geoCellId inválido (${sample.geoCellId})`)
    }
  }
  for (const [sensor, { min, max }] of Object.entries(SENSOR_LIMITS)) {
    const val = sample[sensor]
    if (typeof val === 'number' && (val < min || val > max)) {
      errors.push(`${sensor} fora dos limites (${val})`)
    }
  }
  return errors
}

