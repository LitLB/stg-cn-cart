import { LineItem } from "@commercetools/platform-sdk";
import _ from 'lodash'

interface ILineItem extends LineItem {
    hasChanged?: any
}

function deepEqual(obj1: any, obj2: any) {
    if (obj1 === obj2) return false;
    if (obj1 == null || typeof obj1 !== 'object' ||
        obj2 == null || typeof obj2 !== 'object') {
        return false;
    }
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {

        if (!keys2.includes(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }
    return true;
}

function areArraysNotEqual(arr1: any[], arr2: any[]) {
    for (let i = 0; i < arr1.length; i++) {
        if (deepEqual(arr1[i], arr2[i])) return true;
    }
    return false;
}

function compareLineItemAttributes(lineItemA: ILineItem, lineItemB: LineItem) {
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

    const pricesChanged = areArraysNotEqual(lineItemPricesA, lineItemPricesB)

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
            continue;
        }
        // 4) Compare via JSON (simple deep compare)
        // hasChange[name] = JSON.stringify(valA) !== JSON.stringify(valB);
        hasChange[name] = !_.isEqual(valA, valB);
    }


    return { ...hasChange, ...lineItemA.hasChanged, prices: !isPriceChanged };
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