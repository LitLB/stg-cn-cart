// src/utils/product-utils.ts

import type { Attribute } from '@commercetools/platform-sdk';

export function getAttributeValue(attributes: Attribute[], name: string): any {
	const attribute = attributes.find((attr: Attribute) => attr.name === name);
	return attribute ? attribute.value : null;
}
