import { loadEnv } from './env.js'

function parseArg (name, argv) {
  const arg = argv.find(a => a.startsWith(`--${name}=`))
  return arg ? arg.split('=')[1] : undefined
}

// heurística simples baseada no volume estimado de nodes
// para ajustar limites de agregação e parâmetros de histerese
export function paramsForVolume (volume = 0) {
  if (volume >= 5000) {
    return {
      maxLeavesPerBatch: 8192,
      maxSamplesPerBatch: 32000,
      hysteresisNear: 0.95,
      hysteresisFar: 1.05
    }
  }
  return {
    maxLeavesPerBatch: 4096,
    maxSamplesPerBatch: 16000,
    hysteresisNear: 0.9,
    hysteresisFar: 1.1
  }
}

export function loadHgcConfig (argv = process.argv) {
  loadEnv()

  const volumeArg = parseArg('volume', argv)
  const volume = volumeArg !== undefined
    ? parseInt(volumeArg)
    : parseInt(process.env.HGC_VOLUME ?? '0')

  const defaults = paramsForVolume(volume)

  const cfg = {
    baseRes: parseInt(process.env.HGC_BASE_RES ?? '8'),
    minRes: parseInt(process.env.HGC_MIN_RES ?? '0'),
    volume,
    ...defaults
  }

  const envOverrides = {
    maxLeavesPerBatch: process.env.HGC_MAX_LEAVES_PER_BATCH,
    maxSamplesPerBatch: process.env.HGC_MAX_SAMPLES_PER_BATCH,
    hysteresisNear: process.env.HGC_HYSTERESIS_NEAR,
    hysteresisFar: process.env.HGC_HYSTERESIS_FAR
  }

  const cliOverrides = {
    baseRes: parseArg('baseRes', argv),
    minRes: parseArg('minRes', argv),
    maxLeavesPerBatch: parseArg('maxLeavesPerBatch', argv),
    maxSamplesPerBatch: parseArg('maxSamplesPerBatch', argv),
    hysteresisNear: parseArg('hysteresisNear', argv),
    hysteresisFar: parseArg('hysteresisFar', argv)
  }

  for (const [key, value] of Object.entries({ ...envOverrides, ...cliOverrides })) {
    if (value !== undefined) {
      cfg[key] = key.startsWith('hysteresis') ? parseFloat(value) : parseInt(value)
    }
  }

  return cfg
}
