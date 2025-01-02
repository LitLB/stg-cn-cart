import { Cart, LineItem } from '@commercetools/platform-sdk';
import { createStandardizedError } from '../utils/error.utils';
import { HTTP_STATUSES } from '../constants/http.constant';

export class CartValidator {
    /**
     * Ensures the cart has at least one line item with `selected = true`.
     * Throws an error if none are selected.
     */
    public static validateCartHasSelectedItems(cart: Cart) {
        const hasSelectedItems = cart.lineItems.some((lineItem: LineItem) => {
            return lineItem.custom?.fields?.selected === true;
        });

        if (!hasSelectedItems) {
            throw createStandardizedError({
                statusCode: HTTP_STATUSES.BAD_REQUEST,
                statusMessage: 'No selected items in the cart. Please select items before placing an order.',
            }, 'createOrder');
        }
    }
}
