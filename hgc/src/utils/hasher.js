// src/utils/hasher.js

import { canonical, sha256Hex, merkleRootAndIndex } from './hash-helpers.js'

/* --- (A) hash plano do arquivo (rápido e simples) --- */
export { sha256Hex }

/* --- (B) serialização canônica --- */
export { canonical }

export function sha256HexCanonical (obj) {
  return sha256Hex(canonical(obj))
}

/* --- (C) Merkle raiz dos pares cellId→samples com índice --- */
export { merkleRootAndIndex }

