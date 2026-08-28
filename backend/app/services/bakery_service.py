"""
Bakery service: baker's % recipe scaling and label generation.

These are the bakery/process-manufacturing helpers referenced in the bakery
feature plan. `scale_formula` implements the standard baking-industry math:

  * every ingredient's weight is relative to FLOUR = 100% (baker's %)
  * given a target total dough weight, scale all ingredients up/down
  * dough_yield converts input weight -> dough weight (losses in mixing)
  * bake_loss converts dough weight -> finished baked weight
"""
from decimal import Decimal, ROUND_HALF_UP

from app.models.manufacturing import BomHeader


def as_decimal(value, default='0'):
    if value is None or value == '':
        return Decimal(default)
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def _total_baker_pct(items):
    """Sum of baker's % over all (non-alternate) items.

    If any item lacks baker_pct we fall back to standard qty so the function
    still behaves sensibly for legacy BOMs.
    """
    total = Decimal('0')
    for it in items:
        if it.is_deleted:
            continue
        pct = as_decimal(getattr(it, 'baker_pct', None))
        if pct == 0:
            pct = as_decimal(it.qty_required)
        total += pct
    return total


def _flour_weight_for_target(items, target_dough_weight):
    """Flour weight such that baker's % total maps to the target dough weight.

    total_ingredients_weight = flour * (total_baker_pct / 100)
    so flour = target_dough_weight / (total_baker_pct / 100)
    """
    total_pct = _total_baker_pct(items)
    if total_pct <= 0:
        raise ValueError("Recipe has no ingredients with baker's % / qty.")
    return as_decimal(target_dough_weight) / (total_pct / Decimal('100'))


def scale_formula(bom_id, target_dough_weight):
    """Scale a BOM (recipe) to a target dough weight using baker's %.

    Returns a list of scaled line items plus derived totals (input weight,
    expected dough yield, expected baked weight after bake loss).

    Raises ValueError if the BOM is missing or has no ingredients.
    """
    bom = BomHeader.query.filter_by(id=int(bom_id), is_deleted=False).first()
    if not bom:
        raise ValueError("BOM not found")

    items = [i for i in bom.items if not i.is_deleted]
    if not items:
        raise ValueError("Recipe has no ingredients")

    target = as_decimal(target_dough_weight)
    if target <= 0:
        raise ValueError("Target dough weight must be positive")

    flour_weight = _flour_weight_for_target(items, target)

    scaled = []
    total_ingredient_weight = Decimal('0')
    for it in items:
        pct = as_decimal(getattr(it, 'baker_pct', None))
        if pct == 0:
            pct = as_decimal(it.qty_required)
        weight = flour_weight * (pct / Decimal('100'))
        scaled.append({
            'item_id': it.item_id,
            'material_item_id': it.item_id,
            'uom': it.uom,
            'baker_pct': _round(pct, 4),
            'qty': _round(weight, 4),
        })
        total_ingredient_weight += weight

    dough_yield = as_decimal(bom.dough_yield_pct, '100')
    bake_loss = as_decimal(bom.bake_loss_pct, '0')

    expected_dough = target
    expected_dough_from_input = total_ingredient_weight * (dough_yield / Decimal('100'))
    expected_baked = expected_dough * (Decimal('100') - bake_loss) / Decimal('100')

    return {
        'bom_id': bom.id,
        'recipe_name': bom.name,
        'version': bom.version,
        'target_dough_weight': _round(target, 4),
        'flour_weight': _round(flour_weight, 4),
        'total_baker_pct': _round(_total_baker_pct(items), 4),
        'hydration_pct': _round(as_decimal(bom.hydration_pct), 4),
        'dough_yield_pct': _round(dough_yield, 4),
        'bake_loss_pct': _round(bake_loss, 4),
        'expected_dough_from_input': _round(expected_dough_from_input, 4),
        'expected_baked_weight': _round(expected_baked, 4),
        'items': scaled,
        'ingredients': scaled,
    }


def generate_label(product_id):
    """Build a structured nutrition + allergen label from a product.

    Returns both a readable text block and structured fields the front-end can
    render as a printable label.
    """
    from app.models.product import Product

    product = Product.query.filter_by(id=int(product_id), is_deleted=False).first()
    if not product:
        raise ValueError("Product not found")

    nutrition = product.nutrition or {}
    allergens = product.allergens or []

    def _nut(key, label):
        val = nutrition.get(key)
        return f"{label}: {val}" if val is not None else None

    nutrition_lines = [
        _nut('energy_kcal', 'Energy (kcal)'),
        _nut('protein_g', 'Protein (g)'),
        _nut('fat_g', 'Total Fat (g)'),
        _nut('carbs_g', 'Carbohydrates (g)'),
        _nut('sugar_g', 'Sugar (g)'),
        _nut('fibre_g', 'Dietary Fibre (g)'),
        _nut('sodium_mg', 'Sodium (mg)'),
    ]
    nutrition_lines = [ln for ln in nutrition_lines if ln]

    allergen_text = ", ".join(allergens) if allergens else "None declared"

    lines = [product.name]
    if product.sku:
        lines.append(f"Item: {product.sku}")
    if product.best_before_days:
        lines.append(f"Best Before: {product.best_before_days} days")
    if product.shelf_life_days:
        lines.append(f"Shelf Life: {product.shelf_life_days} days")
    if bool(getattr(product, 'is_fresh', False)):
        lines.append("Fresh / Baked today")
    lines.append("")
    lines.append("Nutrition (per serving):")
    lines.extend(nutrition_lines if nutrition_lines else ["  (not declared)"])
    lines.append("")
    lines.append(f"Contains allergens: {allergen_text}")

    return {
        'product_id': product.id,
        'product_name': product.name,
        'sku': product.sku,
        'best_before_days': product.best_before_days,
        'shelf_life_days': product.shelf_life_days,
        'is_fresh': bool(getattr(product, 'is_fresh', False)),
        'allergens': allergens,
        'nutrition': nutrition,
        'text': "\n".join(lines),
    }


def _round(value, places=4):
    return float(value.quantize(Decimal('1.' + '0' * places), rounding=ROUND_HALF_UP))
