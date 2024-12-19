export default class TsmOrderModel {
    private readonly ctCart: any
    private readonly config: any
    private readonly orderNumber: string
    constructor({
        ctCart,
        orderNumber,
        config
    }: {
        ctCart: any,
        orderNumber: string
        config: any
    }) {

        this.ctCart = ctCart
        this.config = config
        this.orderNumber = orderNumber
    }

    toPayload() {
        // ! Config
        const shopCode = this.config.tsmOrder.shopCode
        const saleCode = this.config.tsmOrder.saleCode
        const saleName = this.config.tsmOrder.saleName

        // ! Generate
        const orderId = this.orderNumber

        // ! Cart
        const { shippingAddress, lineItems } = this.ctCart
        const customer = {
            thaiId: '',
            firstName: shippingAddress.firstName,
            lastName: shippingAddress.lastName,
        }

        const sequenceItems = lineItems.flatMap((lineItem: any, lineItemIndex: number) => {
            const productCode = lineItem.variant.sku
            const productGroup = lineItem.custom?.fields?.productGroup
            const productType = lineItem.custom?.fields?.productType
            let privilege = lineItem?.custom?.fields?.privilege
            privilege = privilege && JSON.parse(privilege);

            const {
                campaignCode = '',
                campaignName = '',
                promotionSetCode = '',
                promotionSetProposition = 999, //999,
            } = privilege || {};

            const price = lineItem.price.value.centAmount
            let quantity = lineItem.quantity
            let noOfItem = 1
            if (this.getProductType(productType) === 'P') {
                quantity = 1
                noOfItem = lineItem.quantity
            }

            //! items.totalAmount = ค่า price * quantity
            const totalAmount = price * quantity

            return Array.from({ length: noOfItem }, (_, quantityIndex) => {
                const sequence = `${(lineItemIndex + 1) + quantityIndex}`.toString()

                //! items.discountAmount = ค่า amount ใน discounts ทั้งหมดรวมกัน
                const { discountAmount: discountAmountBaht, discounts } = this.getItemDiscount({
                    orderId,
                    lineItem,
                    sequence
                })

                //! items.otherPaymentAmount = ค่า amount ใน otherPayments ทั้งหมดรวมกัน
                const { otherPaymentAmount: otherPaymentAmountBaht, otherPayments } = this.getItemOtherPayment({
                    orderId,
                    lineItem,
                    sequence
                })

                //! items.netAmount = ค่า (price * quantity) - discountAmount
                let netAmount = price * quantity
                netAmount -= this.BahtToStang(discountAmountBaht)

                return {
                    id: orderId,
                    sequence: sequence,
                    campaign: {
                        code: campaignCode,
                        name: campaignName,
                    },
                    proposition: '' + promotionSetProposition,
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
                    discountAmount: '' + discountAmountBaht,
                    otherPaymentAmount: '' + otherPaymentAmountBaht,
                    privilegeRequiredValue: '',
                    discounts,
                    otherPayments,
                    serials: [],
                    range: [],
                }
            })
        })

        //! ค่า netAmount ใน items ทั้งหมดรวมกัน
        const totalAmount = sequenceItems.reduce((total: any, item: any) => total + +item.netAmount, 0,)
        //! ค่า discounts (นอก items) ทั้งหมดรวมกัน
        const discounts: any[] = []
        const discountAmount = 0
        //! ค่า ค่า otherPayments (นอก items) ทั้งหมดรวมกัน
        const otherPayments: any[] = []
        const otherPaymentAmount = 0
        //! ค่า totalAmount - discountAmount
        const totalAfterDiscount = totalAmount - discountAmount

        //! ค่า totalAmount - discountAmount - otherPaymentAmount - (ผลรวมของ otherPaymentAmount ใน items) 
        const itemOtherPaymentAmount = sequenceItems.reduce((total: any, item: any) => total + +item.otherPaymentAmount, 0,)
        const grandTotal = totalAmount - discountAmount - otherPaymentAmount - itemOtherPaymentAmount

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
                discounts,
                otherPayments,
                items: sequenceItems,
            },
        };
    }

    getPromotionType = (lineItemType: any) => {
        switch (lineItemType) {
            case 'main_product':
                return '0'
            case 'free_gift':
                return '1'
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

    getItemDiscount = ({
        orderId,
        lineItem,
        sequence,
    }: {
        orderId: string
        lineItem: any
        sequence: any
    }) => {
        let discountAmount = 0
        let no = 1
        const discounts: any[] = []
        let privilege = lineItem?.custom?.fields?.privilege
        privilege = privilege && JSON.parse(privilege);
        let lineItemDiscounts = lineItem?.custom?.fields?.discounts
        lineItemDiscounts = (lineItemDiscounts ?? []).map((v: any) => JSON.parse(v))
        const { promotionSetCode } = privilege
        for (const lineItemDiscount of lineItemDiscounts) {
            const { benefitType, specialPrice, discountBaht } = lineItemDiscount
            if (benefitType === 'add_on') {
                const price = lineItem.price.value.centAmount
                const discount = price - specialPrice
                discounts.push(
                    {
                        id: orderId,
                        sequence,
                        no: '' + no,
                        code: promotionSetCode,
                        amount: '' + this.stangToBaht(discount),
                        serial: '',
                    }
                )
            }

            if (benefitType === 'main_product') {
                const discount = discountBaht
                discounts.push(
                    {
                        id: orderId,
                        sequence,
                        no: '' + no,
                        code: promotionSetCode,
                        amount: '' + this.stangToBaht(discount),
                        serial: '',
                    }
                )
            }
            no++
        }
        discountAmount = discounts.reduce((total: number, discount: any) => {
            return total += +discount.amount
        }, 0)

        return {
            discountAmount,
            discounts
        }
    }

    getItemOtherPayment = ({
        orderId,
        lineItem,
        sequence,
    }: {
        orderId: string
        lineItem: any
        sequence: any
    }) => {
        let otherPaymentAmount = 0
        let lineItemOtherPayments = lineItem?.custom?.fields?.otherPayments
        lineItemOtherPayments = (lineItemOtherPayments ?? []).map((v: any) => JSON.parse(v))

        const otherPayments: any[] = lineItemOtherPayments.map((v: any, index: any) => ({
            id: orderId,
            sequence,
            no: `${index + 1}`.toString(),
            code: v.otherPaymentCode,
            amount: this.stangToBaht(v.otherPaymentAmt).toString(),
            serial: ""
        }))

        otherPaymentAmount = otherPayments.reduce((total: number, otherPayment: any) => {
            return total += +otherPayment.amount
        }, 0)

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

    stangToBaht(stang: number) {
        const fractionDigits = 2

        return stang / Math.pow(10, fractionDigits)
    }

    BahtToStang(baht: number) {
        const fractionDigits = 2

        return baht * Math.pow(10, fractionDigits)
    }
}