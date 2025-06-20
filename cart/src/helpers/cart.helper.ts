// cart.helper.ts

import type { ICart, CustomProductProjection } from "../interfaces/cart";
import CommercetoolsProductProjectionClient from "../adapters/ct-product-projection-client";
import { Cart } from "@commercetools/platform-sdk";

/**
 * Attaches package product projections to an ICart’s items.
 * 
 * The function checks for an item-level "package_code" attribute.
 * If none exist on an item, it falls back to a cart-level package code.
 * The matching package product projection is enriched with mock data:
 *   - "cms" field with an "image" URL.
 *   - In masterVariant: "t1" with pricing and contract details,
 *     and "connector" with a localized description.
 *
 * @param iCart - The mapped cart (ICart) whose items will be enriched.
 * @param ctCart - The original Commercetools cart (to access cart-level custom fields).
 * @returns A Promise resolving to the updated ICart.
 */
export async function attachPackageToCart(iCart: ICart, ctCart: Cart): Promise<ICart> {
    // 1. Get cart-level package code (if present)
    let cartPackageCode: string | undefined;
    if (
        ctCart.custom?.fields?.packageAdditionalInfo &&
        ctCart.custom.fields.packageAdditionalInfo?.obj &&
        ctCart.custom.fields.packageAdditionalInfo.obj?.value &&
        ctCart.custom.fields.packageAdditionalInfo.obj.value?.package_code
    ) {
        cartPackageCode = ctCart.custom.fields.packageAdditionalInfo.obj.value.package_code;
    }

    // 2. Collect distinct package codes from the cart items.
    const packageCodesSet = new Set<string>();
    iCart.items.forEach((item) => {
        const pkgAttr = item.attributes.find((attr) => attr.name === "package_code");
        if (pkgAttr && typeof pkgAttr.value === "string") {
            packageCodesSet.add(pkgAttr.value);
        }
    });

    // If no item-level package codes, use the cart-level one if available.
    if (packageCodesSet.size === 0 && cartPackageCode) {
        packageCodesSet.add(cartPackageCode);
    }

    const packageCodes = Array.from(packageCodesSet);
    if (packageCodes.length === 0) {
        // Nothing to attach—return cart unchanged.
        return iCart;
    }

    // 3. Query for package product projections using the package codes.
    const packageProjections: CustomProductProjection[] =
        await CommercetoolsProductProjectionClient.getProductProjectionByPackageCodes(packageCodes);

    // 4. Build a lookup map: package code => enriched CustomProductProjection.
    const packageMap: Record<string, CustomProductProjection> = {};
    packageProjections.forEach((pkg) => {
        // Extract the package_code from the masterVariant attributes.
        const { attributes = [] } = pkg.masterVariant;
        const pkgAttr = attributes.find((attr) => attr.name === "package_code");
        if (pkgAttr && typeof pkgAttr.value === "string") {
            // Enrich the package with mock data if not already set.
            if (!pkg.cms) {
                pkg.cms = {
                    image: pkg.masterVariant.images?.[0]?.url ?? null
                };
            }
            if (!pkg.masterVariant.t1) {
                const t1 = ctCart?.custom?.fields?.packageAdditionalInfo?.obj?.value?.t1 ?? {}
                pkg.masterVariant.t1 = t1
            }
            if (!pkg.masterVariant.connector) {
                const connector = ctCart?.custom?.fields?.packageAdditionalInfo?.obj?.value?.connector ?? {}
                pkg.masterVariant.connector = connector
            }
            packageMap[pkgAttr.value] = pkg;
        }
    });

    // 5. Attach the matching package projection to each ICart item.
    // iCart.items = iCart.items.map((item) => {
    //     const pkgAttr = item.attributes.find((attr) => attr.name === "package_code");
    //     if (pkgAttr && typeof pkgAttr.value === "string" && packageMap[pkgAttr.value]) {
    //         item.package = packageMap[pkgAttr.value];
    //     } else if (!pkgAttr && cartPackageCode && packageMap[cartPackageCode]) {
    //         // Fallback: attach the cart-level package.
    //         item.package = packageMap[cartPackageCode];
    //     }
    //     return item;
    // });

    iCart.items = iCart.items.filter((item) => item.productType === 'main_product')
    iCart.items = iCart.items.map((item) => {

        // remove indexing when support multiple packages
        item.package = Object.values(packageMap)[0]

        return item
    })


    return iCart;
}


export function attachSimToCart(iCart: ICart, ctCart: Cart): ICart {
    const sim = ctCart.lineItems.find((item) =>  item.custom?.fields?.productType === 'sim')

    iCart.items = iCart.items.filter((item) => item.productType === 'main_product')
    iCart.items = iCart.items.map((item) => {
        item.sim = sim
        return item
    })


    return iCart;
}
