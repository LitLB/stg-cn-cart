export default class TsmOrderModel {
    private readonly ctCart: any
    private readonly config: any
    constructor({
        ctCart,
        config
    }: {
        ctCart: any
        config: any
    }) {

        this.ctCart = ctCart
        this.config = config
    }

    toPayload() {
        // ! Config
        const shopCode = this.config.tsmOrder.shopCode
        const saleCode = this.config.tsmOrder.saleCode
        const saleName = this.config.tsmOrder.saleName

        // ! Generate
        const orderId = this.generateOrderNumber()

        // ! Cart
        const { shippingAddress, lineItems } = this.ctCart
        const customer = {
            thaiId: '',
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
        }

        const items = lineItems.map((lineItem: any, index: number) => {

            const productCode = lineItem.variant.sku
            const productGroup = lineItem.custom?.fields?.productGroup
            const productType = lineItem.custom?.fields?.productType
            let privilege = lineItem?.custom?.fields?.privilege
            privilege = privilege && JSON.parse(privilege);


            const price = lineItem.price.value.centAmount
            const quantity = lineItem.quantity
            const totalAmount = price * quantity
            const netAmount = lineItem.totalPrice.centAmount

            const { discountAmount, discounts } = this.getItemDiscount(orderId, lineItem)
            const { otherPaymentAmount, otherPayments } = this.getItemOtherPayment()

            const {
                campaignCode = '',
                promotionSetCode = '',
                promotionSetProposition, //999,
            } = privilege || {};
            return {
                id: orderId,
                sequence: '' + (index + 1),
                campaign: {
                    code: campaignCode,
                    name: '',
                },
                proposition: promotionSetProposition,
                promotionSet: promotionSetCode,
                promotionType: this.getPromotionType(productType),
                group: '' + productGroup,
                product: {
                    productType: this.getProductType(productType),
                    productCode,
                },
                mobile: '',
                price: '' + this.stangToBaht(price),
                quantity: '' + quantity,
                totalAmount: '' + this.stangToBaht(totalAmount),
                installmentAmount: '0',
                depositAmount: '0',
                netAmount: '' + this.stangToBaht(netAmount),
                discountAmount: '' + this.stangToBaht(discountAmount),
                otherPaymentAmount: '' + this.stangToBaht(otherPaymentAmount),
                privilegeRequiredValue: '',
                discounts,
                otherPayments,
                serials: [],
                range: [],
            }
        })

        const totalAmount = items.reduce((total: any, item: any) => total + +item.netAmount, 0,)
        const discountAmount = items.reduce((total: any, item: any) => total + +item.discountAmount, 0,)
        const otherPaymentAmount = items.reduce((total: any, item: any) => total + +item.otherPaymentAmount, 0,)
        const totalAfterDiscount = totalAmount
        const grandTotal = totalAmount

        return {
            order: {
                orderId,
                customer: {
                    id: customer.thaiId,
                    name: `${customer.firstName} ${customer.lastName}`,
                    address: this.getCustomerAddress(),
                },
                shop: {
                    code: shopCode,
                },
                sale: {
                    code: saleCode,
                    name: saleName,
                },
                totalAmount: '' + totalAmount,
                discountAmount: '' + discountAmount,
                totalAfterDiscount: '' + totalAfterDiscount,
                otherPaymentAmount: '' + otherPaymentAmount,
                grandTotal: '' + grandTotal,
                discounts: [],
                otherPayments: [],
                items,
            },
        };
    }

    getPromotionType = (lineItemType: any) => {
        switch (lineItemType) {
            case 'main_product':
                return '0'
            case 'service':
                return '0'
            case 'add_on':
                return '2'
            // case 'insurance':
            //     return 'S'
            default:
                return '0'
        }
    }

    getProductType = (lineItemType: any) => {

        switch (lineItemType) {
            case 'main_product':
                return 'P'
            case 'service':
                return 'S'
            case 'add_on':
                return 'P'
            case 'insurance':
                return 'S'
            default:
                return 'P'
        }
    }

    calculateTotalDiscountAmount = (lineItem: any) => {
        return lineItem.discountedPricePerQuantity.reduce((totalDiscount: any, quantity: any) => {
            const unitDiscount = quantity.discountedPrice.includedDiscounts.reduce(
                (sum: any, discount: any) => sum + discount.discountedAmount.centAmount,
                0
            );
            return totalDiscount + unitDiscount * quantity.quantity;
        }, 0);
    }

    getItemDiscount = (orderId: string, lineItem: any) => {
        let discountAmount = 0
        let discounts: any[] = []
        let privilege = lineItem?.custom?.fields?.privilege
        privilege = privilege && JSON.parse(privilege);

        const { type, promotionSetCode, specialPrice } = privilege || {}


        if (type === 'add_on') {
            discountAmount = this.calculateTotalDiscountAmount(lineItem)
            const price = lineItem.price.value.centAmount
            const discount = price - specialPrice
            discounts = [
                {
                    id: orderId,
                    sequence: '1',
                    no: '1',
                    code: promotionSetCode,
                    amount: '' + this.stangToBaht(discount),
                    serial: '',
                }
            ]
        }
        return {
            discountAmount,
            discounts
        }
    }

    getItemOtherPayment = () => {
        const otherPaymentAmount = 0
        const otherPayments: any[] = []
        return {
            otherPaymentAmount,
            otherPayments
        }
    }


    getCustomerAddress = () => {
        const { shippingAddress } = this.ctCart
        const {
            streetName,
            postalCode = '',
            city: district = '',
            state: country = '',
            building,
            phone,
            custom
        } = shippingAddress || {}

        const {
            soi,
            village,
            floor,
            moo,
            houseNo = '',
            roomNo,
            subDistrict = ''
        } = custom || {}


        return `${houseNo} ${subDistrict} ${district} ${country} ${postalCode}`
    }


    generateOrderNumber = () => {
        const timestamp = Date.now().toString(); // Current timestamp
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0'); // Random 4-digit number
        return `ORD-${timestamp}-${random}`; // Combine parts into an order number
    }

    stangToBaht(stang: number) {
        const fractionDigits = 2

        return stang / Math.pow(10, fractionDigits)
    }
}