// Poli call wording, shared by the server (name cleanup) and the TV (labels, speech). Mirrors samples/antrian_poli.

/** Drops the SIMRS title suffix (", NY", ".TN", " , AN", ...) and closes up spaced-out names ("N U R" -> "NUR"). */
export function cleanPatientName(name: string) {
  const clean = name.replace(/\s*[,.]\s*(AN|TN|BY|NY|NN)\b\.?/gi, "").trim().replace(/\s+/g, " ");
  const words = clean.split(" ");
  return words.length > 1 && words.every((w) => w.length === 1) ? words.join("") : clean;
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/** "POLI THT-KL" -> "Poli THT-KL", "KIA (BIDAN)" -> "KIA (Bidan)": words of ≤ 3 letters or with "-" stay upper case. */
export function poliLabel(poli: string) {
  return poli
    .split(" ")
    .map((word) => {
      const letters = word.replace(/[^A-Za-z]/g, "");
      if (word.includes("-") || (letters.length > 0 && letters.length <= 3 && word === word.toUpperCase())) return word;
      return word.replace(/[A-Za-z]+/, capitalize);
    })
    .join(" ");
}

/** Patient name in title case for small text ("PUTRI RISKA" -> "Putri Riska"). */
export function titleCaseName(name: string) {
  return name.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

const NAME_PREFIXES: [RegExp, string][] = [
  [/^dg\.?\s+/, "daeng "],
  [/^st\.?\s+/, "siti "],
  [/^hj\.?\s+/, "hajjah "],
  [/^h\.\s*/, "haji "],
];

/** How the voice reads a name: lower case, common abbreviations spelled out. */
export function spokenName(name: string) {
  let spoken = name.toLowerCase().trim();
  for (const [re, word] of NAME_PREFIXES) spoken = spoken.replace(re, word);
  return spoken;
}

export function spokenPoli(poli: string) {
  return poli.toLowerCase().replace(/\btht-kl\b/, "THT-KAEL");
}

/** "PM013" -> "PM 13": the voice reads a number, not digits with leading zeros (same as callText). */
export function spokenQueueNumber(queueNumber: string) {
  return queueNumber.replace(/^(\D*)0*(\d)/, (_, prefix, digit) => `${prefix} ${digit}`).trim();
}

export function poliCallText(queueNumber: string, pasien: string, poli: string) {
  return `Nomor antrian ${spokenQueueNumber(queueNumber)}. Atas nama ${spokenName(pasien)}. Silahkan menuju ke ruang ${spokenPoli(poli)}.`;
}
