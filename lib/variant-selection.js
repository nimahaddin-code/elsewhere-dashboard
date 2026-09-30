export function getOptionValues(variants, optionKey) {
  return cleanOptionValues(variants.filter((variant) => variant.active !== false).map((variant) => variant[optionKey]).filter(Boolean));
}

export function getSelectedOptionValues(assignment) {
  return cleanOptionValues(assignment?.selected ?? []);
}

export function cleanOptionValues(values) {
  const uniqueValues = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
  return uniqueValues.filter((candidate, candidateIndex) => {
    const otherValues = uniqueValues.filter((_, index) => index !== candidateIndex);
    if (otherValues.length < 2) return true;
    return canonicalizeOptionText(candidate) !== canonicalizeOptionText(otherValues.join(''));
  });
}

export function normalizeVariantOptions(variants) {
  const hasSecondDimension = variants.some((variant) => typeof variant.option2_value === 'string' && variant.option2_value.trim());
  return variants.map((variant) => {
    const option1Value = typeof variant.option1_value === 'string' ? variant.option1_value.trim() : '';
    const option2Value = typeof variant.option2_value === 'string' ? variant.option2_value.trim() : '';
    if (option1Value || option2Value) {
      return {
        ...variant,
        option1_value: option1Value || null,
        option2_value: option2Value || null,
      };
    }

    // A blank legacy/default row beside a real two-dimensional matrix is not
    // another option. Promoting its full name is what created the long,
    // accidental size/flavour entries in the editor.
    const legacyName = hasSecondDimension ? '' : (typeof variant.name === 'string' ? variant.name.trim() : '');
    return {
      ...variant,
      option1_value: legacyName || null,
      option2_value: null,
    };
  });
}

export function deactivateIncompleteMatrixRows(variants) {
  const hasCompleteMatrix = variants.some((variant) =>
    variant.active !== false &&
    String(variant.option1_value ?? '').trim() &&
    String(variant.option2_value ?? '').trim(),
  );
  if (!hasCompleteMatrix) return variants;

  return variants.map((variant) => {
    if (variant.active === false) return variant;
    const hasOption1 = Boolean(String(variant.option1_value ?? '').trim());
    const hasOption2 = Boolean(String(variant.option2_value ?? '').trim());
    return hasOption1 && hasOption2 ? variant : { ...variant, active: false };
  });
}

function canonicalizeOptionText(value) {
  return String(value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function variantNameMatchesOptions(variantName, ...optionValues) {
  const canonicalName = canonicalizeOptionText(variantName);
  const canonicalOptions = optionValues.map(canonicalizeOptionText).filter(Boolean);
  return Boolean(canonicalName) && canonicalOptions.length > 0 && canonicalOptions.every((option) => canonicalName.includes(option));
}

export function variantDetailsForSync(existing, defaults) {
  if (!existing) return defaults;
  return {
    local_price: existing.local_price,
    weight_grams: existing.weight_grams,
    photo_url: existing.photo_url ?? '',
    sale_mode: existing.sale_mode,
    preorder_capacity: existing.preorder_capacity ?? null,
  };
}

export function activateVariantCombination(variant) {
  return { ...variant, active: true };
}

export function inferOptionRenames(currentValues, nextValues) {
  const current = cleanOptionValues(currentValues);
  const next = cleanOptionValues(nextValues);
  const removed = current.filter((value) => !next.includes(value));
  const available = next.filter((value) => !current.includes(value));
  const renames = {};

  for (const oldValue of removed) {
    if (!available.length) break;
    const oldIndex = current.indexOf(oldValue);
    let bestIndex = 0;
    for (let index = 1; index < available.length; index += 1) {
      if (Math.abs(next.indexOf(available[index]) - oldIndex) < Math.abs(next.indexOf(available[bestIndex]) - oldIndex)) bestIndex = index;
    }
    renames[oldValue] = available.splice(bestIndex, 1)[0];
  }

  return renames;
}

export function renameVariantOptions(variants, optionKey, renames) {
  return variants.map((variant) => {
    const currentValue = variant[optionKey] ?? '';
    const nextValue = renames[currentValue];
    if (!nextValue) return variant;
    const next = { ...variant, [optionKey]: nextValue };
    return {
      ...next,
      name: [next.option1_value, next.option2_value].filter(Boolean).join(' / ') || variant.name,
    };
  });
}

export function getCompatibleOptionValues(variants, filterKeyOrValue, filterValueOrKey, maybeOptionKey) {
  if (typeof filterValueOrKey === 'string' && maybeOptionKey) {
    const filterKey = filterKeyOrValue;
    const filterValue = filterValueOrKey;
    const optionKey = maybeOptionKey;
    const matches = filterValue ? variants.filter((variant) => variant[filterKey] === filterValue) : variants;
    return cleanOptionValues(matches.map((variant) => variant[optionKey]).filter(Boolean));
  }

  const optionValue = filterKeyOrValue;
  const optionKey = filterValueOrKey;
  const matches = optionValue ? variants.filter((variant) => variant.option1_value === optionValue) : variants;
  return cleanOptionValues(matches.map((variant) => variant[optionKey]).filter(Boolean));
}

export function findMatchingVariant(variants, option1Value, option2Value) {
  if (!option1Value && !option2Value) return variants[0] || null;
  return (
    variants.find((variant) => {
      const variantOption1 = variant.option1_value ?? '';
      const variantOption2 = variant.option2_value ?? '';
      return variantOption1 === (option1Value ?? '') && variantOption2 === (option2Value ?? '');
    }) || null
  );
}
