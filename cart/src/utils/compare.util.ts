import { LineItem } from "@commercetools/platform-sdk";
import _ from 'lodash'

interface ILineItem extends LineItem {
    hasChanged?: any,
    parentQuantity? : number
}


function compareLineItemAttributes(lineItemA: ILineItem, lineItemB: ILineItem) {


    const parentQuantityA = lineItemA.parentQuantity ?? 0
    const parentQuantityB = lineItemB.parentQuantity ?? 0

    const hasChange: any = {};
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


    // If the arrays are empty, it has no attributes
    if (lineItemA.variant.attributes.length === 0 && lineItemB.variant.attributes.length === 0) {
        return false;
    }

    const lineItemPricesA = lineItemA.variant.prices ?? []
    const lineItemPricesB = lineItemB.variant.prices ?? []

    const isPriceChanged = _.isEqual(lineItemPricesA, lineItemPricesB)

    // If the arrays have different attribute names, it has no attributes
    const attrsA = lineItemA.variant.attributes;
    const attrsB = lineItemB.variant.attributes;

    // Convert arrays to Maps keyed by attribute.name
    const mapA = new Map(attrsA.map(attr => [attr.name, attr.value]));
    const mapB = new Map(attrsB.map(attr => [attr.name, attr.value]));


    // Gather all attribute names from both line items
    const allAttrNames = new Set([...mapA.keys(), ...mapB.keys()]);


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
        if (valA === undefined || valB === undefined) {
            hasChange[name] = true;
        }
        // 4) Compare via JSON (simple deep compare)
        const comparisons: any = {
            quantity_max: () => (hasChange['quantity_over_parent_max'] = parentQuantityA > valB),
            quantity_min: () => (hasChange['quantity_lower_parent_min'] = parentQuantityA < valB),
            sku_quantity_max: () => (hasChange['quantity_over_sku_max'] = lineItemA.quantity > valB),
            sku_quantity_min: () => (hasChange['quantity_lower_sku_min'] = lineItemA.quantity < valB),
        };

        // Perform specific checks for defined attributes
        if (comparisons[name]) comparisons[name]();

        hasChange[name] = !_.isEqual(valA, valB);

        hasChange['quantity_over_parent_max'] ??= false;
        hasChange['quantity_lower_parent_min'] ??= false;
        hasChange['quantity_over_sku_max'] ??= false;
        hasChange['quantity_lower_sku_min'] ??= false;

    }

    const result = {
        ...hasChange,
        prices: !isPriceChanged,
        ...lineItemA.hasChanged
    };
    
    // Sort the keys and recreate the object
    const sortedResult = Object.keys(result)
        .sort() // Sort keys alphabetically (or use a custom comparator function)
        .reduce((sortedObj:any, key) => {
            sortedObj[key] = result[key];
            return sortedObj;
        }, {});

    return sortedResult;
}

export function compareLineItemsArrays(lineItemsA: LineItem[], lineItemsB: LineItem[]) {


    return lineItemsA.map((itemA) => {
        const matchingItemB = lineItemsB.find(itemB => itemB.id === itemA.id);
        if (!matchingItemB) {
            return { productId: itemA.productId, skuId: itemA.variant.sku, hasChange: "Line item was remove by condition." };
        }
        const hasChange = compareLineItemAttributes(itemA, matchingItemB);

        return { productId: itemA.productId, skuId: itemA.variant.sku, hasChange };
    });
}