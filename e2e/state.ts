import fs from 'node:fs';
import { STATE_FILE } from './testdata';

export type E2eState = {
  kelasId?: string;
  siswaId?: string;
  guruId?: string;
  babId?: string;
  ujianUhId?: string;
  ujianUtsId?: string;
};

/** State seed yang ditulis globalSetup & dipakai spec saat berjalan. */
export function bacaState(): E2eState {
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}
