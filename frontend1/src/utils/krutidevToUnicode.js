// KrutiDev (Remington/legacy ANSI font) -> Unicode Devanagari live converter.
// KrutiDev is not Unicode: it maps Devanagari glyphs onto ASCII key positions,
// and its "i" matra (ि) is typed BEFORE the consonant even though it must render
// AFTER it in Unicode. This converter re-orders and re-maps text typed using a
// standard KrutiDev keyboard layout into correct Unicode Devanagari on the fly,
// so it can be stored/searched/rendered normally everywhere else in the app.

// Multi-character sequences must be matched before single characters (longest match first).
const multiCharMap = [
  ['dRO', 'द्रो'], ['fpz', 'ऱ्य'], ['{a', 'ऱ'], ['{s', 'ऱ'],
  ['DDs', 'ट्ट्स'], ['Nis', 'ण्ि'],
  ['{k', 'र्क'], ['{[k', 'र्ख'], ['{x', 'र्ग'], ['{X', 'र्घ'],
  ['{P', 'र्च'], ['{N', 'र्ण'], ['{r', 'र्त'], ['{n', 'र्न'],
  ['{i', 'र्ि'],
  ['DZ', 'ट्ज'], ['DZ+', 'ट्ज्ञ'],
  ['{n{', 'र्न्'],
  ['J~‍', 'द्य'],
  ['dz', 'द्ज'],
  ['xz', 'ग्ज'],
  ['{H', 'र्ह'],
  ['{m', 'र्म'], ['{y', 'र्य'], ['{ if', 'र्षि'],
  ['{ph', 'र्फ'],
  ['{, k', 'र्, क'],
  ['+', 'ज्ञ'],
  ['{+', 'र्ज्ञ'],
  ['{;', 'र्:'],
  ['{}', 'र्'],
  ['{', 'र्'],
];

// Consonants / independent glyphs (single or two-key)
const baseMap = {
  'k': 'क', 'K': 'ख', 'x': 'ग', 'X': 'घ', 'z': 'ङ',
  'p': 'च', 'P': 'छ', 'ti': 'त्ि', 'T': 'झ', '›': 'ञ',
  'V': 'ट', 'V,': 'ठ', 'M': 'ड', ',': 'ढ', ']': 'ण',
  'r': 'त', 'Fk': 'थ', 'n': 'न', 'n~': 'न्',
  'iz': 'प्र', 'i': 'प', 'Q': 'फ',
  'c': 'ब', 'Hk': 'भ', 'e': 'म',
  ';': 'य', 'j': 'र', 'y': 'ल', 'o': 'व',
  'l': 'स', '"k': 'श', '"': 'श', '\'k': 'ष', '\'': 'ष',
  'g': 'ह', '{k': 'क्ष', 'K': 'ख',
  'v': 'अ', 'vk': 'आ', 'b': 'इ', 'bZ': 'ई',
  'm': 'उ', 'w': 'ऊ', '_': 'ऋ',
  's': 'ए', 'S': 'ऐ', 'vks': 'ओ', 'vkS': 'औ',
  'a': 'ं', 'A': 'ँ', 'H': 'ः',
  'a‚': 'ऑ',
  '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
  '5': '५', '6': '६', '7': '७', '8': '८', '9': '९',
  '|': 'द्य', 'B': 'ठ', 'N': 'ण',
  'W': 'फ़', 'ph': 'फ',
};

// Matras (vowel signs). KEY: 'f' (i-matra) is typed BEFORE the consonant in
// KrutiDev but must be placed AFTER the consonant's unicode letter.
const matraMap = {
  'k': 'ा', 'q': 'ु', 'w': 'ू', 'S': 'ै', 'ks': 'ो', 'kS': 'ौ',
  '`': 'ृ', '~':'', 'a':'ं', 'ॅ':'ॅ',
};

// Pre-consonant i-matra key
const I_MATRA_KEY = 'f';
const I_MATRA_UNICODE = 'ि';

/**
 * Convert a string typed on a KrutiDev keyboard into Unicode Devanagari.
 * Runs a longest-match tokenizer over the input, then fixes up the
 * pre-posed i-matra ("f" + consonant -> consonant + "ि").
 */
export function krutidevToUnicode(input) {
  if (!input) return input;

  let out = '';
  let i = 0;
  const s = input;

  // sort multi-char keys by length desc for longest-match
  const multi = [...multiCharMap].sort((a, b) => b[0].length - a[0].length);

  while (i < s.length) {
    let matched = false;

    // handle pre-posed i-matra: "fd" -> "कि" (consonant + i-matra)
    if (s[i] === I_MATRA_KEY) {
      // find the following consonant token (1-2 chars) and place matra after it
      let rest = s.slice(i + 1);
      let consonant = null;
      let consLen = 0;
      for (const len of [2, 1]) {
        const chunk = rest.slice(0, len);
        if (baseMap[chunk]) { consonant = baseMap[chunk]; consLen = len; break; }
      }
      if (consonant) {
        out += consonant + I_MATRA_UNICODE;
        i += 1 + consLen;
        matched = true;
      }
    }

    if (matched) continue;

    // multi-char sequences
    for (const [key, val] of multi) {
      if (s.startsWith(key, i)) {
        out += val;
        i += key.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Was the last emitted char a "bare" consonant (no matra/halant/vowel-sign yet)?
    // If so, an ambiguous key (present in both baseMap and matraMap) is far more
    // likely to be the matra riding on top of that consonant than a fresh consonant.
    const lastChar = out[out.length - 1];
    const lastWasBareConsonant = lastChar && /[\u0915-\u0939]/.test(lastChar);

    const two = s.slice(i, i + 2);
    if (lastWasBareConsonant && matraMap[two]) { out += matraMap[two]; i += 2; continue; }
    if (baseMap[two]) { out += baseMap[two]; i += 2; continue; }
    if (matraMap[two]) { out += matraMap[two]; i += 2; continue; }

    // single-char base / matra
    const one = s[i];
    if (lastWasBareConsonant && matraMap[one]) { out += matraMap[one]; i += 1; continue; }
    if (baseMap[one]) { out += baseMap[one]; i += 1; continue; }
    if (matraMap[one]) { out += matraMap[one]; i += 1; continue; }

    // halant / virama key
    if (one === '~') { out += '्'; i += 1; continue; }

    // punctuation / space / unmapped -> pass through
    out += one;
    i += 1;
  }

  return out;
}
