import TsmOrderModel from '../src/models/tsm-order.model';
import * as encryptUtil from '../src/utils/apigeeEncrypt.utils';
import _ from 'lodash';

jest.mock('../src/utils/apigeeEncrypt.utils');

describe('TsmOrderModel', () => {
	const mockEncrypt = jest.fn((val) => `encrypted-${val}`);
	(encryptUtil.apigeeEncrypt as jest.Mock).mockImplementation(mockEncrypt);

	const baseCart = {
		shippingAddress: {
			firstName: 'Test',
			lastName: 'User',
			streetName: 'Street',
			postalCode: '10000',
			city: 'Bangkok',
			state: 'TH',
			custom: {
				houseNo: '123',
				subDistrict: 'Sub',
			},
		},
		custom: {
		fields: {
			journey: 'device_bundle_existing',
			package: {
			obj: {
				value: {
				package_code: '1112',
				name: {
					'th-TH': 'Test Package',
				},
				t1: {
					advancedPayment: 100000,
					advancedPaymentCode: 'CODE123',
					advancedPaymentProposition: '999',
					advancedPaymentPromotionSet: 'SET123',
					proposition: 'PROP123',
					promotionSet: 'PROMO123',
				},
				},
			},
			},
		},
		},
		lineItems: [
			{
				quantity: 1,
				price: { value: { centAmount: 10000 } },
				variant: { sku: 'SKU123' },
				custom: {
				fields: {
					productGroup: '1',
					productType: 'main_product',
					discounts: [
					JSON.stringify({
						source: 'campaignDiscount',
						discountCode: 'DISC1',
						benefitType: 'main_product',
						discountBaht: 100,
					}),
					],
					otherPayments: [
					JSON.stringify({
						otherPaymentCode: 'PAY123',
						otherPaymentAmt: 50,
					}),
					],
					campaignVerifyValues: [
					JSON.stringify({ name: 'ThaiId', value: '1234567890123' }),
					JSON.stringify({ name: 'Msisdn', value: '0812345678' }),
					],
				},
				},
			},
		],
	};

	const baseConfig = {
		tsmOrder: {
			shopCode: 'SHOP01',
			saleCode: 'SALE01',
			saleName: 'Sale User',
		},
		apigee: {
			privateKeyEncryption: 'PRIVATE_KEY',
		},
	};

	const baseCouponDiscounts = {
		discounts: [
			{ amount: 10 },
		],
		otherPayments: [
			{ amount: 5 },
		],
	};

	it('should generate full payload correctly', () => {
		const model = new TsmOrderModel({
			ctCart: baseCart,
			orderNumber: 'ORDER123',
			config: baseConfig,
			couponDiscounts: baseCouponDiscounts,
		});

		const payload = model.toPayload();

		expect(payload).toHaveProperty('order');
		expect(payload.order.orderId).toBe('ORDER123');
		expect(payload.order.customer.name).toBe('Test User');
		expect(payload.order.customer.id).toBe('encrypted-1234567890123');
		expect(payload.order.totalAmount).toBeDefined();
		expect(payload.order.items.length).toBeGreaterThan(0);
	});

	it('should handle free gift item correctly', () => {
		const cartWithFreeGift = _.cloneDeep(baseCart);
		cartWithFreeGift.lineItems[0].custom.fields.productType = 'free_gift';

		const model = new TsmOrderModel({
			ctCart: cartWithFreeGift,
			orderNumber: 'ORDER456',
			config: baseConfig,
			couponDiscounts: baseCouponDiscounts,
		});

		const payload = model.toPayload();
		const item = payload.order.items[0];

		expect(item.product.productType).toBe('P');
		expect(item.price).toBe('0');
		expect(item.totalAmount).toBe('0');
		expect(item.netAmount).toBe('0');
	});

	it('should handle line item with add_on discount', () => {
		const cart = _.cloneDeep(baseCart);
		cart.lineItems[0].custom.fields.discounts = [
			JSON.stringify({
				source: 'addonCampaign',
				benefitType: 'add_on',
				specialPrice: 5000,
				discountBaht: 0,
			}),
		];

		const model = new TsmOrderModel({
		ctCart: cart,
		orderNumber: 'ORDER789',
		config: baseConfig,
		couponDiscounts: baseCouponDiscounts,
		});

		const payload = model.toPayload();
		expect(payload.order.items[0].discounts.length).toBeGreaterThan(0);
	});

	it('should return correct customer address string', () => {
		const model = new TsmOrderModel({
			ctCart: baseCart,
			orderNumber: 'ORDER999',
			config: baseConfig,
			couponDiscounts: baseCouponDiscounts,
		});

		const address = model.getCustomerAddress();
		expect(address).toBe('123 Sub Bangkok TH 10000');
	});

	it('should handle error in toPayload gracefully', () => {
		const brokenModel = new TsmOrderModel({
			ctCart: undefined, // Will cause error
			orderNumber: 'ERROR_CASE',
			config: baseConfig,
			couponDiscounts: baseCouponDiscounts,
		});

		expect(() => brokenModel.toPayload()).toThrow();
	});
});
