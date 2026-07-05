/** Normalise un code-barres scanné ou saisi (supprime espaces, tirets, etc.). */
export function normalizeBarcode(value: string): string {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

/** Extrait l'id variante depuis un code VSM0000000055. */
export function parseVsmVariantId(value: string): number | null {
  const normalized = normalizeBarcode(value);
  const match = normalized.match(/^VSM0*(\d+)$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Simple Code128-B SVG barcode for download/print (numeric + uppercase). */
export function renderBarcodeSvg(value: string, height = 60): string {
  const normalized = value.replace(/[^0-9A-Z]/gi, "").toUpperCase();
  if (!normalized) return "";

  const patterns: Record<string, string> = {
    "0": "11011001100", "1": "11001101100", "2": "11001100110", "3": "10010011000",
    "4": "10010001100", "5": "10001001100", "6": "10011001000", "7": "10011000100",
    "8": "10001100100", "9": "11001001000", A: "11001000100", B: "11000100100",
    C: "10110011100", D: "10011011100", E: "10011001110", F: "10111001100",
    G: "10011101100", H: "10011100110", I: "11001110010", J: "11001011100",
    K: "11001001110", L: "11011100100", M: "11001110100", N: "11101101110",
    O: "11101001100", P: "11100101100", Q: "11100100110", R: "11101100100",
    S: "11100110100", T: "11100110010", U: "11011011000", V: "11011000110",
    W: "11000110110", X: "10100011000", Y: "10001011000", Z: "10001000110",
  };

  let bits = "11010010000";
  for (const ch of normalized) {
    bits += patterns[ch] || patterns["0"];
  }
  bits += "1100011101011";

  const barWidth = 2;
  const width = bits.length * barWidth;
  let x = 0;
  let rects = "";

  for (const bit of bits) {
    if (bit === "1") {
      rects += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="#000"/>`;
    }
    x += barWidth;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 24}" viewBox="0 0 ${width} ${height + 24}">
    ${rects}
    <text x="${width / 2}" y="${height + 18}" text-anchor="middle" font-family="monospace" font-size="12">${normalized}</text>
  </svg>`;
}

export function downloadBarcodeSvg(value: string, filename?: string) {
  const svg = renderBarcodeSvg(value);
  if (!svg) return;
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `barcode-${value}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}
