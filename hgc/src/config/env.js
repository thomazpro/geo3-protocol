import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

export function loadEnv() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
  return {
    pinataJwt: process.env.PINATA_JWT,
    polygonRpcUrl: process.env.POLYGON_RPC_URL,
    privateKey: process.env.PRIVATE_KEY,
    geoDataRegistry: process.env.GEO_DATA_REGISTRY,
    nodeDidRegistry: process.env.NODE_DID_REGISTRY,
    geoRewardManager: process.env.GEO_REWARD_MANAGER,
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  };
}
