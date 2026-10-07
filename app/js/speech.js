// Turns a guide into short sentences for the phone's speech synthesis (long utterances get cut off in Chrome).
const MAX = 220;

function split(text) {
  const out = [];
  for (const sentence of String(text ?? '').match(/[^.!?]+[.!?]*\s*/g) ?? []) {
    let s = sentence.trim();
    while (s.length > MAX) {
      const cut = s.lastIndexOf(' ', MAX);
      out.push(s.slice(0, cut > 0 ? cut : MAX));
      s = s.slice(cut > 0 ? cut + 1 : MAX);
    }
    if (s) out.push(s);
  }
  return out;
}

export function speechChunks(g) {
  const parts = [`${g.title}.`, ...split(g.why)];
  if (g.lookFor?.length) parts.push('Look for these.', ...g.lookFor.flatMap(split));
  if (g.facts?.length) parts.push('Some facts.', ...g.facts.flatMap(split));
  for (const k of g.kids ?? []) parts.push('A question for the kids.', ...split(k.q), 'The answer.', ...split(k.a));
  return parts;
}
