import test from 'node:test';
import assert from 'node:assert/strict';
import { activateVariantCombination, cleanOptionValues, getCompatibleOptionValues, findMatchingVariant, getOptionValues, inferOptionRenames, normalizeVariantOptions, renameVariantOptions, variantDetailsForSync, variantNameMatchesOptions } from '../lib/variant-selection.js';

const variants = [
  { id: 'v1', option1_value: 'Violeta', option2_value: 'XXS' },
  { id: 'v2', option1_value: 'Violeta', option2_value: 'XS' },
  { id: 'v3', option1_value: 'Serenata', option2_value: 'XS' },
  { id: 'v4', option1_value: 'Serenata', option2_value: 'S' },
  { id: 'v5', option1_value: 'Serenata', option2_value: 'XL' },
];

await test('compatible sizes only appear for the selected colourway', () => {
  assert.deepEqual(getCompatibleOptionValues(variants, 'Serenata', 'option2_value'), ['XS', 'S', 'XL']);
  assert.deepEqual(getCompatibleOptionValues(variants, 'Violeta', 'option2_value'), ['XXS', 'XS']);
});

await test('invalid size combinations are rejected instead of falling back to another colourway', () => {
  assert.equal(findMatchingVariant(variants, 'Serenata', 'XL')?.id, 'v5');
  assert.equal(findMatchingVariant(variants, 'Serenata', 'M'), null);
});

await test('either option dimension can be used on its own', () => {
  const option1Only = [
    { id: 'volume-30', option1_value: '30ml', option2_value: null },
    { id: 'volume-15', option1_value: '15ml', option2_value: null },
  ];
  const option2Only = [
    { id: 'size-s', option1_value: null, option2_value: 'S' },
    { id: 'size-m', option1_value: null, option2_value: 'M' },
  ];

  assert.equal(findMatchingVariant(option1Only, '30ml', '')?.id, 'volume-30');
  assert.equal(findMatchingVariant(option2Only, '', 'M')?.id, 'size-m');
});

await test('legacy and new one-dimensional variants share one option group', () => {
  const normalized = normalizeVariantOptions([
    { id: 'new', name: 'Bpop Cola', option1_value: 'Bpop Cola', option2_value: null },
    { id: 'legacy-null', name: 'Dark Chocolate 65g', option1_value: null, option2_value: null },
    { id: 'legacy-blank', name: 'Milk Chocolate 180g', option1_value: '  ', option2_value: '' },
  ]);

  assert.deepEqual(
    normalized.map((variant) => variant.option1_value),
    ['Bpop Cola', 'Dark Chocolate 65g', 'Milk Chocolate 180g'],
  );
  assert.deepEqual(getOptionValues(normalized, 'option2_value'), []);
});

await test('normalization preserves products with two real option dimensions', () => {
  const [normalized] = normalizeVariantOptions([
    { id: 'two-dimensions', name: 'Blue / M', option1_value: ' Blue ', option2_value: ' M ' },
  ]);
  assert.equal(normalized.option1_value, 'Blue');
  assert.equal(normalized.option2_value, 'M');
});

await test('legacy default rows do not become a long option beside a two-dimensional matrix', () => {
  const normalized = normalizeVariantOptions([
    { id: 'default', name: 'Classic Tiramisu Almond White Chocolate Confectionery (300g)', option1_value: null, option2_value: null },
    { id: 'matrix', name: '150g / Matcha White Chocolate', option1_value: '150g', option2_value: 'Matcha White Chocolate' },
  ]);

  assert.equal(normalized[0].option1_value, null);
  assert.deepEqual(getOptionValues(normalized, 'option1_value'), ['150g']);
});

await test('inactive choices stay removed when the editor reloads after save', () => {
  const rows = [
    { id: 'removed', active: false, option1_value: 'BPOP Cola', option2_value: null },
    { id: 'kept', active: true, option1_value: '65g', option2_value: null },
  ];

  assert.deepEqual(getOptionValues(rows, 'option1_value'), ['65g']);
});

await test('checking an inactive combination reactivates it without losing its details', () => {
  const inactive = { id: 'matcha-65', active: false, option1_value: '65g', option2_value: 'Matcha White Chocolate', local_price: 8, photo_url: 'matcha.jpg' };

  assert.deepEqual(activateVariantCombination(inactive), { ...inactive, active: true });
});

await test('editing an option typo renames existing rows without losing IDs or details', () => {
  const rows = [
    { id: 'dark-50', option1_value: '50g', option2_value: 'Dark Chocolate', sku: 'DARK-50', local_price: 8, photo_url: 'dark.jpg' },
    { id: 'milk-50', option1_value: '50g', option2_value: 'Milk Chocolate', sku: 'MILK-50', local_price: 9, photo_url: 'milk.jpg' },
  ];
  const option1Renames = inferOptionRenames(['50g'], ['50 gr']);
  const renamed = renameVariantOptions(rows, 'option1_value', option1Renames);

  assert.deepEqual(option1Renames, { '50g': '50 gr' });
  assert.deepEqual(renamed.map((row) => [row.id, row.option1_value, row.name, row.sku, row.local_price, row.photo_url]), [
    ['dark-50', '50 gr', '50 gr / Dark Chocolate', 'DARK-50', 8, 'dark.jpg'],
    ['milk-50', '50 gr', '50 gr / Milk Chocolate', 'MILK-50', 9, 'milk.jpg'],
  ]);
});

await test('reordering option values is not mistaken for a rename', () => {
  assert.deepEqual(inferOptionRenames(['65g', '150g', '180g'], ['150g', '65g', '180g']), {});
});

await test('legacy combined names can be matched to a new two-dimension combination', () => {
  assert.equal(variantNameMatchesOptions('CaramelCrisp — Large Bag', 'Large Bag', 'Caramel Crisp'), true);
  assert.equal(variantNameMatchesOptions('Chicago Mix — Petite Tin', 'Petite Tin', 'Chicago Mix'), true);
  assert.equal(variantNameMatchesOptions('CheeseCorn — Medium Bag', 'Small Bag', 'Cheese Corn'), false);
});

await test('an accidentally concatenated option is removed when its original values still exist', () => {
  assert.deepEqual(
    cleanOptionValues([
      'Matcha White Chocolate',
      'White Chocolate',
      'Dark Chocolate',
      'Milk Chocolate',
      'Matcha White ChocolateWhite ChocolateDark ChocolateMilk Chocolate',
    ]),
    ['Matcha White Chocolate', 'White Chocolate', 'Dark Chocolate', 'Milk Chocolate'],
  );
});

await test('saving a matrix preserves the current details of an existing variant', () => {
  const defaults = { local_price: 10, weight_grams: 100, photo_url: 'default.jpg', sale_mode: 'preorder', preorder_capacity: null };
  const existing = { local_price: 15, weight_grams: 150, photo_url: 'variant.jpg', sale_mode: 'stock', preorder_capacity: 5 };
  assert.deepEqual(variantDetailsForSync(existing, defaults), existing);
  assert.equal(variantDetailsForSync(null, defaults), defaults);
});
