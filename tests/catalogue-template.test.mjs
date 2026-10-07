import assert from "node:assert/strict";
import test from "node:test";
import { transformSync } from "esbuild";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../lib/catalogue-template.ts", import.meta.url), "utf8");
const transformed = transformSync(source, { format: "cjs", loader: "ts", target: "node22" }).code;
const module = { exports: {} };
vm.runInNewContext(transformed, { module, exports: module.exports, Intl, Math });
const { cataloguePriceLabel, catalogueThemeFor, containRect, fitProductTitle, CATALOGUE_THEMES } = module.exports;

test("categories share one layout but receive their established color families", () => {
  assert.equal(catalogueThemeFor("Pakaian"), CATALOGUE_THEMES.fashion);
  assert.equal(catalogueThemeFor("Makanan & Minuman"), CATALOGUE_THEMES.food);
  assert.equal(catalogueThemeFor("Kesehatan & Suplemen"), CATALOGUE_THEMES.health);
  assert.equal(catalogueThemeFor("Skincare & Makeup"), CATALOGUE_THEMES.beauty);
  assert.equal(catalogueThemeFor("Lainnya"), CATALOGUE_THEMES.fashion);
  assert.notEqual(CATALOGUE_THEMES.food.accent, CATALOGUE_THEMES.fashion.accent);
  assert.notEqual(CATALOGUE_THEMES.health.accent, CATALOGUE_THEMES.beauty.accent);
  assert.deepEqual(Array.from(CATALOGUE_THEMES.fashion.gradientStops, stop => Array.from(stop)), [
    [0, "#641341"], [0.16, "#bf3c7a"], [0.32, "#f2a9ca"], [0.5, "#fff8fc"],
    [0.68, "#f5b1cf"], [0.84, "#bb3977"], [1, "#5b103b"],
  ]);
});

test("landscape and portrait photos remain fully visible without stretching", () => {
  const landscape = containRect(1600, 900, 100, 200, 800, 700);
  assert.equal(landscape.width, 800);
  assert.equal(landscape.height, 450);
  assert.equal(landscape.y, 325);
  const portrait = containRect(800, 1600, 100, 200, 800, 700);
  assert.equal(portrait.height, 700);
  assert.equal(portrait.width, 350);
  assert.equal(portrait.x, 325);
});

test("long product names fit in at most two lines", () => {
  const fitted = fitProductTitle((value, size) => value.length * size * 0.55, "THE ORDINARY GLYCOLIC ACID EXFOLIATING TONER LIMITED EDITION", 790);
  assert.ok(fitted.fontSize >= 25);
  assert.ok(fitted.lines.length <= 2);
  assert.equal(fitted.lines.join(" "), "THE ORDINARY GLYCOLIC ACID EXFOLIATING TONER LIMITED EDITION");
  const unbroken = fitProductTitle((value, size) => value.length * size * 0.55, "SUPERCALIFRAGILISTICEXPIALIDOCIOUSULTRALONGPRODUCTNAME", 300);
  assert.ok(unbroken.lines.length <= 2);
  assert.ok(unbroken.lines.every(line => line.endsWith("…") || line.length * unbroken.fontSize * 0.55 <= 300));
});

test("large exact prices use Indonesian grouping", () => {
  assert.equal(cataloguePriceLabel(123456789), "Rp123.456.789");
});
