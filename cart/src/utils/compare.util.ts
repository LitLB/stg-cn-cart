import { LineItem } from "@commercetools/platform-sdk";

interface ILineItem extends LineItem {
    hasChanged?: any
}

function compareLineItemAttributes(lineItemA: ILineItem, lineItemB: LineItem) {

    // If either line item doesn't have a variant, it has no attributes
    if (!lineItemA.variant || !lineItemB.variant) {
        return false;
    }

    // If either line item doesn't have an attribute array, it has no attributes
    if (!lineItemA.variant.attributes || !lineItemB.variant.attributes) {
        return false;
    }

    // If the arrays are empty, it has no attributes
    if (lineItemA.variant.attributes.length === 0 && lineItemB.variant.attributes.length === 0) {
        return false;
    }

    // If the arrays have different attribute names, it has no attributes
    const attrsA = lineItemA.variant.attributes;
    const attrsB = lineItemB.variant.attributes;

    // Convert arrays to Maps keyed by attribute.name
    const mapA = new Map(attrsA.map(attr => [attr.name, attr.value]));
    const mapB = new Map(attrsB.map(attr => [attr.name, attr.value]));

    // Gather all attribute names from both line items
    const allAttrNames = new Set([...mapA.keys(), ...mapB.keys()]);

    const hasChange: any = {};

    const ignoredAttributes = ['akeneo_id', 'product_id', 'status', 'company_code', 'journey'];

  

    for (const name of allAttrNames) {

        // 1) Skip ignored attributes early
        if (ignoredAttributes.includes(name)) {
            continue;
        }

        // 2) Get values from both maps
        const valA = mapA.get(name);
        const valB = mapB.get(name);

        // 3) If missing on one side => changed
        if (valA === undefined || valB === undefined)  {
            hasChange[name] = true;
            continue;
        }

        // 4) Compare via JSON (simple deep compare)
        hasChange[name] = JSON.stringify(valA) !== JSON.stringify(valB);
    }

    return {...hasChange, ...lineItemA.hasChanged};
}

export function compareLineItemsArrays(lineItemsA: LineItem[], lineItemsB: LineItem[]) {

    return lineItemsA.map((itemA) => {
        const matchingItemB = lineItemsB.find(itemB => itemB.id === itemA.id);
        if (!matchingItemB) {
            return { productId: itemA.productId, skuId: itemA.variant.sku,   hasChange: "Line item was remove by condition." };
        }
        const hasChange = compareLineItemAttributes(itemA, matchingItemB);

        return { productId: itemA.productId,skuId: itemA.variant.sku, hasChange };
    });
}