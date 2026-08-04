#!/usr/bin/env node
/**
 * Enforces the colour contract declared in web/src/styles/tokens.css.
 *
 * Design review by eyeball does not catch a 3.2:1 accent used as body text.
 * This does. It parses the CONTRACT block and both token blocks out of the CSS,
 * converts OKLCH to sRGB, and computes WCAG 2.1 relative-luminance ratios.
 *
 * Exit 0 = every documented pair meets its target in BOTH themes.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const TOKENS = resolve(HERE, "../web/src/styles/tokens.css");

// --- colour maths ------------------------------------------------------------

/** OKLCH -> linear sRGB -> gamma-encoded sRGB, clamped. */
function oklchToSrgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return lin.map((u) => {
    const c = Math.min(1, Math.max(0, u));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  });
}

function relativeLuminance([r, g, b]) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(rgbA, rgbB) {
  const a = relativeLuminance(rgbA);
  const b = relativeLuminance(rgbB);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function toHex(rgb) {
  return "#" + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

// --- parsing -----------------------------------------------------------------

/** Pull `name target` lines out of the CONTRACT ... END CONTRACT comment. */
function parseContract(css) {
  const block = css.match(/CONTRACT\s*\n([\s\S]*?)END CONTRACT/);
  if (!block) throw new Error("No CONTRACT block found in tokens.css");

  return block[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([a-z0-9-]+)\/([a-z0-9-]+)\s+([\d.]+)$/i);
      if (!m) throw new Error(`Unparseable contract line: "${line}"`);
      return { fg: m[1], bg: m[2], target: Number(m[3]) };
    });
}

/**
 * Extract `--name: oklch(L C H);` declarations from a selector block.
 * Tokens using alpha or non-oklch values are skipped — the contract only
 * references opaque colours.
 */
function parseTokens(css, selector) {
  const start = css.indexOf(selector + " {");
  if (start === -1) throw new Error(`Selector ${selector} not found`);
  const end = css.indexOf("\n}", start);
  const body = css.slice(start, end);

  const tokens = new Map();
  const re = /--([a-z0-9-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/gi;
  let m;
  while ((m = re.exec(body)) !== null) {
    tokens.set(m[1], oklchToSrgb(Number(m[2]), Number(m[3]), Number(m[4])));
  }
  return tokens;
}

// --- run ---------------------------------------------------------------------

const css = await readFile(TOKENS, "utf8");
const contract = parseContract(css);

const themes = [
  { name: "light", tokens: parseTokens(css, ":root") },
  { name: "dark", tokens: parseTokens(css, ".dark") },
];

let failures = 0;
let checks = 0;

for (const theme of themes) {
  console.log(`\n  ${theme.name}`);
  for (const { fg, bg, target } of contract) {
    const a = theme.tokens.get(fg);
    const b = theme.tokens.get(bg);

    if (!a || !b) {
      console.log(`  MISSING  ${fg} / ${bg} — token not defined in ${theme.name}`);
      failures += 1;
      continue;
    }

    checks += 1;
    const ratio = contrast(a, b);
    const ok = ratio >= target;
    if (!ok) failures += 1;

    console.log(
      `  ${ok ? "pass" : "FAIL"}  ${`${fg} / ${bg}`.padEnd(42)} ` +
        `${ratio.toFixed(2)}:1 (needs ${target.toFixed(1)})  ${toHex(a)} on ${toHex(b)}`,
    );
  }
}

console.log(`\n  ${checks} pairs checked, ${failures} failing.\n`);
process.exit(failures > 0 ? 1 : 0);
