export const NICKNAMES = Object.freeze([
  'Dorel', 'Gigel', 'Gogu', 'Mișu', 'Bebe', 'Costică', 'Fănel', 'Neluțu',
  'Sandu', 'Vio', 'Puiu', 'Marcel', 'Elvis', 'Vali', 'Sorinel',
]);

function hash(text) {
  let value = 2166136261;
  for (const character of text) {
    value = Math.imul(value ^ character.codePointAt(0), 16777619);
  }
  return value >>> 0;
}

// Derive both fields from the phrase itself, independent of playback order,
// browser storage, clock, and game randomness. Keep the salts and name order stable.
export function attributionFor(phrase) {
  const text = phrase.normalize('NFC').trim();
  const name = NICKNAMES[hash(`pacanele:author:${text}`) % NICKNAMES.length];
  const year = 1990 + hash(`pacanele:year:${text}`) % 37;
  return `— ${name}, ${year}`;
}
