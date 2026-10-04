// Reads an itinerary folder into one payload: data/ is the plan, private/ holds details to keep encrypted.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function loadTripDir(dir) {
  const read = async (rel, required = false) => {
    let text;
    try {
      text = await readFile(join(dir, rel), 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      if (required) throw new Error(`${rel} not found in ${dir}`);
      return undefined;
    }
    try { return JSON.parse(text); } catch (e) { throw new Error(`${rel}: ${e.message}`); }
  };
  const trip = await read('data/trip.json', true);
  const guides = await read('data/guides.json');
  const transport = await read('data/transport.json');
  const stays = await read('private/stays.json');
  const config = await read('private/config.json');
  return { format: 'fieldbook/1', trip, guides: guides?.guides ?? [], transport: transport ?? {}, private: { stays: stays ?? {}, config: config ?? {} } };
}
