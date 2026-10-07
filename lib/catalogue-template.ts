export type CatalogueTheme = {
  ink: string;
  accent: string;
  panel: string;
  panelBorder: string;
  gradientStops: ReadonlyArray<readonly [number, string]>;
};

const shared = { panel: "#fffdfd", panelBorder: "rgba(255, 255, 255, 0.78)" };

export const CATALOGUE_THEMES = {
  fashion: {
    ...shared,
    ink: "#361225",
    accent: "#8f255d",
    gradientStops: [[0, "#641341"], [0.16, "#bf3c7a"], [0.32, "#f2a9ca"], [0.5, "#fff8fc"], [0.68, "#f5b1cf"], [0.84, "#bb3977"], [1, "#5b103b"]],
  },
  food: {
    ...shared,
    ink: "#49330d",
    accent: "#a06b16",
    gradientStops: [[0, "#7b4e08"], [0.16, "#d99927"], [0.32, "#f6d873"], [0.5, "#fffbed"], [0.68, "#f7df87"], [0.84, "#d89324"], [1, "#704405"]],
  },
  health: {
    ...shared,
    ink: "#17391f",
    accent: "#3e7a4c",
    gradientStops: [[0, "#225532"], [0.16, "#63a36e"], [0.32, "#b8d9ae"], [0.5, "#f8fff5"], [0.68, "#c4dfb8"], [0.84, "#5c9967"], [1, "#1c4b2a"]],
  },
  beauty: {
    ...shared,
    ink: "#173745",
    accent: "#4e8ba4",
    gradientStops: [[0, "#28677e"], [0.16, "#69abc2"], [0.32, "#b9ddea"], [0.5, "#f8fdff"], [0.68, "#c7e5ef"], [0.84, "#63a4bb"], [1, "#225b70"]],
  },
} satisfies Record<string, CatalogueTheme>;

export function catalogueThemeFor(category: string): CatalogueTheme {
  if (/makanan|minuman|snack|food|drink/i.test(category)) return CATALOGUE_THEMES.food;
  if (/kecantikan|skincare|makeup|beauty|cosmetic/i.test(category)) return CATALOGUE_THEMES.beauty;
  if (/obat|kesehatan|suplemen|vitamin|health|medicine/i.test(category)) return CATALOGUE_THEMES.health;
  return CATALOGUE_THEMES.fashion;
}

export function containRect(
  sourceWidth: number,
  sourceHeight: number,
  targetX: number,
  targetY: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { x: targetX, y: targetY, width: 0, height: 0 };
  }
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: targetX + (targetWidth - width) / 2,
    y: targetY + (targetHeight - height) / 2,
    width,
    height,
  };
}

export function fitProductTitle(
  measure: (value: string, fontSize: number) => number,
  value: string,
  maxWidth: number,
  maxLines = 2,
) {
  const words = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  for (let fontSize = 48; fontSize >= 18; fontSize -= 1) {
    const lines: string[] = [];
    for (const word of words) {
      const current = lines.at(-1) || "";
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate, fontSize) <= maxWidth) {
        if (current) lines[lines.length - 1] = candidate;
        else lines.push(candidate);
      } else if (lines.length < maxLines && measure(word, fontSize) <= maxWidth) {
        lines.push(word);
      } else {
        break;
      }
    }
    if (lines.length <= maxLines && lines.join(" ") === words.join(" ") && lines.every(line => measure(line, fontSize) <= maxWidth)) {
      return { fontSize, lines };
    }
  }

  const fontSize = 18;
  const fullText = words.join(" ");
  const lines: string[] = [];
  let remaining = fullText;
  while (remaining && lines.length < maxLines) {
    let end = remaining.length;
    while (end > 1 && measure(`${remaining.slice(0, end)}${lines.length === maxLines - 1 && end < remaining.length ? "…" : ""}`, fontSize) > maxWidth) end -= 1;
    const lastSpace = remaining.lastIndexOf(" ", end);
    if (lastSpace > Math.floor(end * 0.55)) end = lastSpace;
    const truncated = lines.length === maxLines - 1 && end < remaining.length;
    lines.push(`${remaining.slice(0, end).trim()}${truncated ? "…" : ""}`);
    remaining = truncated ? "" : remaining.slice(end).trim();
  }
  return { fontSize, lines };
}

export function cataloguePriceLabel(price: number) {
  return `Rp${Math.max(0, Math.round(price)).toLocaleString("id-ID")}`;
}
