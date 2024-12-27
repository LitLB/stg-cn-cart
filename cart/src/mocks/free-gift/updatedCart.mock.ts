// cart/src/mocks/updatedCartWithFreeGiftAdded/updatedCart.mock.ts

import { firstItem } from "./firstItem.mock";
import { secondItem } from "./secondItem.mock";

/*
* ของแถม (Free Gift)
* ประเภทโปรโมชั่น (Promotion Type) = 1
* 1. ลูกค้าเลือกสินค้าหลัก: เมื่อเลือกสินค้าหลัก (Main Product) ทาง FE จะทำการเรียก API เส้นทาง 3.1 Add Item to Cart เพื่อเพิ่มสินค้าหลักลงในตะกร้า (Cart)
* 2. ระบบค้นหาแคมเปญของแถม: ระบบ BE จะทำการค้นหาว่ามีแคมเปญของแถมหรือไม่ หากมี ระบบจะเพิ่มข้อมูลลงใน availableBenefits ในรูปแบบ Array เพื่อให้ลูกค้าเลือกของแถม
* 3. ลูกค้าเลือกของแถม: เมื่อลูกค้าเลือกสินค้าของแถม FE จะเรียก API เส้นทาง 3.2 Add Item to Cart เพื่อเพิ่มสินค้าของแถมลงในตะกร้า (Cart) และส่ง Privilege ไปยัง TSM
* 4. ระบบคำนวณส่วนลด: ระบบจะคำนวณส่วนลด โดยตั้งค่าราคาของสินค้าของแถมเป็น 0 และให้ส่วนลด 100% แล้วอัพเดท ตะกร้าสินค้า (Cart) เพื่อปรับให้ตะกร้าได้รับเอฟเฟคจากส่วนลด
*/

export const updatedCartWithFreeGiftAdded = {
    cartId: '54172a39-a0bf-4510-bfdd-a96b7f7f34d7',
    locale: 'th-TH',
    campaignGroup: 'mass',
    journey: 'single_product',
    subtotalPrice: 5089000,
    totalDiscount: 89000,
    totalPriceAfterDiscount: 5000000, // 5089000 - 89000 = 5000000
    shippingCost: 0,
    grandTotal: 5000000,
    currencyCode: 'THB',
    totalQuantity: 5,
    shippingMethod: null,
    paymentMethod: null,
    shippingAddress: null,
    billingAddress: null,
    quantitiesByProductType: {
        main_product: 4,
        free_gift: 1,
    },
    items: [
        firstItem, // Main Product Added with Free Gift List
        secondItem, // Free Gift
    ],
    triggeredCampaigns: [],
    appliedEffects: [],
    createdAt: '2024-12-20T01:57:02.933Z',
    updatedAt: '2024-12-20T02:23:47.059Z',
    deleteDaysAfterLastModification: 1,
    expiredAt: '2024-12-21T02:23:47.059Z',
};