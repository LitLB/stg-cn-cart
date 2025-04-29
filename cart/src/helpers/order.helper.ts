import { CustomProductProjection } from "../interfaces/cart";
import { IOrder } from "../interfaces/order.interface";

import CommercetoolsProductProjectionClient from "../adapters/ct-product-projection-client";
import { Order } from "@commercetools/platform-sdk";

export async function attachPackageToOrder(iOrder: IOrder, order: Order): Promise<IOrder> {
    // 1. Get cart-level package code (if present)
    let orderPackageCode: string | undefined;
    if (
        order.custom?.fields?.packageAdditionalInfo &&
        order.custom.fields.packageAdditionalInfo?.obj &&
        order.custom.fields.packageAdditionalInfo.obj?.value &&
        order.custom.fields.packageAdditionalInfo.obj.value?.package_code
    ) {
        orderPackageCode = order.custom.fields.packageAdditionalInfo.obj.value.package_code;
    }

    // 2. Collect distinct package codes from the cart items.
    const packageCodesSet = new Set<string>();
    iOrder.items.forEach((item) => {
        const pkgAttr = item.attributes.find((attr) => attr.name === "package_code");
        if (pkgAttr && typeof pkgAttr.value === "string") {
            packageCodesSet.add(pkgAttr.value);
        }
    });

    // If no item-level package codes, use the cart-level one if available.
    if (packageCodesSet.size === 0 && orderPackageCode) {
        packageCodesSet.add(orderPackageCode);
    }

    const packageCodes = Array.from(packageCodesSet);
    if (packageCodes.length === 0) {
        // Nothing to attach—return cart unchanged.
        return iOrder;
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
                    image: "https://images.cdn.australia-southeast1.gcp.commercetools.com/11c6ea39-ac1a-4868-87d8-5bd23bc70f03/tree-736885_640-LX3K9HiH.jpg"
                };
            }
            if (!pkg.masterVariant.t1) {
                const t1 = order?.custom?.fields?.packageAdditionalInfo?.obj?.value?.t1 ?? {}
                pkg.masterVariant.t1 = t1
            }
            if (!pkg.masterVariant.connector) {
                const connector = order?.custom?.fields?.packageAdditionalInfo?.obj?.value?.connector ?? {}
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

    iOrder.items = iOrder.items.filter((item) => item.productType === 'main_product')
    iOrder.items = iOrder.items.map((item) => {

        // remove indexing when support multiple packages
        item.package = Object.values(packageMap)[0]

        return item
    })


    return iOrder;
}