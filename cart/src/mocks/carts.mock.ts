export const tsmOrderPayloadWithFreeGift = {
  order: {
    orderId: 'ORD-1734581123252-5917',
    customer: {
      id: '',
      name: 'Somchai Suwan',
      address: '  Khlong Toei Bangkok 10110',
    },
    shop: { code: '80001999' },
    sale: { code: '900CV003', name: 'Cvecom03' },
    totalAmount: '13390',
    discountAmount: '0',
    totalAfterDiscount: '13390',
    otherPaymentAmount: '0',
    grandTotal: '13390',
    discounts: [],
    otherPayments: [],
    items: [
      {
        id: 'ORD-1734581123252-5917',
        sequence: '1',
        campaign: { code: '', name: '' },
        proposition: '999',
        promotionSet: '',
        promotionType: '0',
        group: '1',
        product: { productType: 'P', productCode: 'o-main-product-sku-1001' },
        mobile: '',
        price: '12500',
        quantity: '1',
        totalAmount: '12500',
        installmentAmount: '0',
        depositAmount: '0',
        netAmount: '12500',
        discountAmount: '0',
        otherPaymentAmount: '0',
        privilegeRequiredValue: '',
        discounts: [],
        otherPayments: [],
        serials: [],
        range: [],
      },
      {
        id: 'ORD-1734581123252-5917',
        sequence: '2',
        campaign: { code: '', name: '' },
        proposition: '999',
        promotionSet: 'UI034',
        promotionType: '1',
        group: '1',
        product: { productType: 'P', productCode: 'o-add-on-1-sku-1001' },
        mobile: '',
        price: '890',
        quantity: '1',
        totalAmount: '890',
        installmentAmount: '0',
        depositAmount: '0',
        netAmount: '890',
        discountAmount: '0',
        otherPaymentAmount: '0',
        privilegeRequiredValue: '',
        discounts: [],
        otherPayments: [],
        serials: [],
        range: [],
      },
    ],
  },
};

export const cartWithFreeGift = {
  type: 'Cart',
  id: '467e3766-d63c-4571-87a2-0a9765a43fd4',
  version: 26,
  versionModifiedAt: '2024-12-18T07:22:13.586Z',
  lastMessageSequenceNumber: 1,
  createdAt: '2024-12-18T07:21:44.596Z',
  lastModifiedAt: '2024-12-18T07:22:13.586Z',
  lastModifiedBy: {
    clientId: 'Ea4Qtl5uCinAa8Hx-6zUeXvT',
    isPlatformClient: false,
  },
  createdBy: {
    clientId: 'Hfl3Z7_NrxC_Z2rd5LJRAK2W',
    isPlatformClient: false,
    anonymousId: '486aa0c7-439f-42b5-8129-82f3d687a222',
  },
  anonymousId: '486aa0c7-439f-42b5-8129-82f3d687a222',
  locale: 'th-TH',
  lineItems: [
    {
      id: '37c60b41-721c-4f58-9af9-c68b24388c52',
      productId: '08c91f85-f3ad-407c-9e7c-164661ea1f93',
      productKey: '8a2b3703-edec-4dd7-815c-099c1d725b20',
      name: { 'th-TH': 'o-main-product-1', 'en-US': 'o-main-product-1' },
      productType: {
        typeId: 'product-type',
        id: '02584416-7fac-4a37-a511-be6b3e329664',
        version: 407,
      },
      productSlug: {
        'th-TH': 'o-main-product-1',
        'en-US': 'o-main-product-1',
      },
      variant: {
        id: 1,
        sku: 'o-main-product-sku-1001',
        key: 'o-main-product-sku-1001',
        prices: [
          {
            id: '51e92823-9837-42de-8f98-8c873663afff',
            value: {
              type: 'centPrecision',
              currencyCode: 'THB',
              centAmount: 1250000,
              fractionDigits: 2,
            },
          },
          {
            id: '281d66b4-d9c6-47de-954b-d35667b8fbcb',
            value: {
              type: 'centPrecision',
              currencyCode: 'THB',
              centAmount: 1250000,
              fractionDigits: 2,
            },
            customerGroup: {
              typeId: 'customer-group',
              id: '94e4dca6-8b56-4861-ab92-4fbeefacb228',
            },
            validFrom: '2024-10-31T17:00:00.000Z',
          },
        ],
        images: [],
        attributes: [
          { name: 'product_id', value: 'o-main-product-1' },
          {
            name: 'status',
            value: { key: 'enabled', label: 'Enabled' },
          },
          {
            name: 'akeneo_id',
            value: '56cff072-ca2f-4a96-b5ea-3933643e20a2',
          },
          {
            name: 'insurance_reference',
            value: [
              {
                typeId: 'product',
                id: '72ae2669-c545-4b5f-90fa-8a93ebd7c14f',
              },
            ],
          },
        ],
        assets: [],
        availability: {
          channels: {
            'b3ed9456-9890-4119-b981-5624ee4e6d6b': {
              isOnStock: true,
              availableQuantity: 100,
              version: 6,
              id: '5afc1fec-0af0-4115-ae05-9f8b4608fe80',
            },
          },
        },
      },
      price: {
        id: 'b0eb3901-9ddd-4216-b683-b62d8c5fc779',
        value: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 1250000,
          fractionDigits: 2,
        },
      },
      quantity: 1,
      discountedPricePerQuantity: [],
      supplyChannel: {
        typeId: 'channel',
        id: 'b3ed9456-9890-4119-b981-5624ee4e6d6b',
      },
      taxRate: {
        name: 'Bangkok',
        amount: 0.07,
        includedInPrice: true,
        country: 'TH',
        state: 'Bangkok',
        id: 'opgU3dD5',
        subRates: [],
      },
      perMethodTaxRate: [],
      addedAt: '2024-12-18T07:21:54.295Z',
      lastModifiedAt: '2024-12-18T07:21:54.295Z',
      state: [
        {
          quantity: 1,
          state: {
            typeId: 'state',
            id: '4edd1d7a-f5ac-4ec8-b575-29dd9e87e020',
          },
        },
      ],
      priceMode: 'ExternalPrice',
      lineItemMode: 'Standard',
      totalPrice: {
        type: 'centPrecision',
        currencyCode: 'THB',
        centAmount: 1250000,
        fractionDigits: 2,
      },
      taxedPrice: {
        totalNet: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 1168224,
          fractionDigits: 2,
        },
        totalGross: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 1250000,
          fractionDigits: 2,
        },
        taxPortions: [
          {
            rate: 0.07,
            amount: {
              type: 'centPrecision',
              currencyCode: 'THB',
              centAmount: 81776,
              fractionDigits: 2,
            },
            name: 'Bangkok',
          },
        ],
        totalTax: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 81776,
          fractionDigits: 2,
        },
      },
      taxedPricePortions: [],
      custom: {
        type: {
          typeId: 'type',
          id: '27d2c7ca-385b-4668-bbcf-526c1f2607ff',
        },
        fields: {
          productType: 'main_product',
          productGroup: 1,
          discounts: [],
          privilege: '{}',
        },
      },
    },
    {
      id: '2723e3a3-b3bf-4a91-8921-b7dd9eb113ad',
      productId: '2973331a-c3b1-4d5b-a042-7db5cb84ee09',
      productKey: '8d361adb-6dcd-4230-baa6-8b2c00371e76',
      name: { 'th-TH': 'o-add-on-1', 'en-US': 'o-add-on-1' },
      productType: {
        typeId: 'product-type',
        id: '02584416-7fac-4a37-a511-be6b3e329664',
        version: 407,
      },
      productSlug: { 'th-TH': 'o-add-on-1', 'en-US': 'o-add-on-1' },
      variant: {
        id: 1,
        sku: 'o-add-on-1-sku-1001',
        key: 'o-add-on-1-sku-1001',
        prices: [
          {
            id: '7c06468a-58fb-412d-ae3a-7061e60c2d96',
            value: {
              type: 'centPrecision',
              currencyCode: 'THB',
              centAmount: 89000,
              fractionDigits: 2,
            },
            customerGroup: {
              typeId: 'customer-group',
              id: '94e4dca6-8b56-4861-ab92-4fbeefacb228',
            },
          },
        ],
        images: [],
        attributes: [
          { name: 'product_id', value: 'o-add-on-1' },
          {
            name: 'akeneo_id',
            value: 'fbb52f3b-563e-4227-8a53-2c63b861bf65',
          },
          {
            name: 'status',
            value: { key: 'enabled', label: 'Enabled' },
          },
        ],
        assets: [],
        availability: {
          channels: {
            'b3ed9456-9890-4119-b981-5624ee4e6d6b': {
              isOnStock: true,
              availableQuantity: 100,
              version: 5,
              id: 'edab2007-589a-4f40-af3b-8f724fe9723c',
            },
          },
        },
      },
      price: {
        id: '845e758e-c93c-4318-b37b-96f8e21e075d',
        value: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 89000,
          fractionDigits: 2,
        },
      },
      quantity: 1,
      discountedPricePerQuantity: [],
      supplyChannel: {
        typeId: 'channel',
        id: 'b3ed9456-9890-4119-b981-5624ee4e6d6b',
      },
      taxRate: {
        name: 'Bangkok',
        amount: 0.07,
        includedInPrice: true,
        country: 'TH',
        state: 'Bangkok',
        id: 'opgU3dD5',
        subRates: [],
      },
      perMethodTaxRate: [],
      addedAt: '2024-12-18T07:22:00.009Z',
      lastModifiedAt: '2024-12-18T07:22:00.009Z',
      state: [
        {
          quantity: 1,
          state: {
            typeId: 'state',
            id: '4edd1d7a-f5ac-4ec8-b575-29dd9e87e020',
          },
        },
      ],
      priceMode: 'ExternalPrice',
      lineItemMode: 'Standard',
      totalPrice: {
        type: 'centPrecision',
        currencyCode: 'THB',
        centAmount: 89000,
        fractionDigits: 2,
      },
      taxedPrice: {
        totalNet: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 83178,
          fractionDigits: 2,
        },
        totalGross: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 89000,
          fractionDigits: 2,
        },
        taxPortions: [
          {
            rate: 0.07,
            amount: {
              type: 'centPrecision',
              currencyCode: 'THB',
              centAmount: 5822,
              fractionDigits: 2,
            },
            name: 'Bangkok',
          },
        ],
        totalTax: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 5822,
          fractionDigits: 2,
        },
      },
      taxedPricePortions: [],
      custom: {
        type: {
          typeId: 'type',
          id: '27d2c7ca-385b-4668-bbcf-526c1f2607ff',
        },
        fields: {
          productGroup: 1,
          productType: 'free_gift', // TODO: free_gift, add_on
          discounts: [],
          // addOnGroup: 'add_on_1', // TODO:
          // TODO: Adjust privilege for Free Gift.
          privilege:
            '{"benefitType":"free_gift","campaignCode":"","promotionSetCode":"UI034","promotionSetProposition":"999","group":"free_gift_1","discountBaht":0,"discountPercent":0,"specialPrice":79000,"isForcePromotion":false}',
        },
      },
    },
  ],
  cartState: 'Active',
  totalPrice: {
    type: 'centPrecision',
    currencyCode: 'THB',
    centAmount: 1345900,
    fractionDigits: 2,
  },
  taxedPrice: {
    totalNet: {
      type: 'centPrecision',
      currencyCode: 'THB',
      centAmount: 1257851,
      fractionDigits: 2,
    },
    totalGross: {
      type: 'centPrecision',
      currencyCode: 'THB',
      centAmount: 1345900,
      fractionDigits: 2,
    },
    taxPortions: [
      {
        rate: 0.07,
        amount: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 88049,
          fractionDigits: 2,
        },
        name: 'Bangkok',
      },
    ],
    totalTax: {
      type: 'centPrecision',
      currencyCode: 'THB',
      centAmount: 88049,
      fractionDigits: 2,
    },
  },
  country: 'TH',
  taxedShippingPrice: {
    totalNet: {
      type: 'centPrecision',
      currencyCode: 'THB',
      centAmount: 6449,
      fractionDigits: 2,
    },
    totalGross: {
      type: 'centPrecision',
      currencyCode: 'THB',
      centAmount: 6900,
      fractionDigits: 2,
    },
    taxPortions: [
      {
        rate: 0.07,
        amount: {
          type: 'centPrecision',
          currencyCode: 'THB',
          centAmount: 451,
          fractionDigits: 2,
        },
        name: 'Bangkok',
      },
    ],
    totalTax: {
      type: 'centPrecision',
      currencyCode: 'THB',
      centAmount: 451,
      fractionDigits: 2,
    },
  },
  shippingMode: 'Single',
  shippingInfo: {
    shippingMethodName: 'จัดส่งปกติ',
    price: {
      type: 'centPrecision',
      currencyCode: 'THB',
      centAmount: 6900,
      fractionDigits: 2,
    },
    'shippingRat  te': {
      price: {
        type: 'centPrecision',
        currencyCode: 'THB',
        centAmount: 6900,
        fractionDigits: 2,
      },
      tiers: [
        {
          type: 'CartValue',
          minimumCentAmount: 1500000,
          price: {
            type: 'centPrecision',
            currencyCode: 'THB',
            centAmount: 0,
            fractionDigits: 2,
          },
        },
      ],
    },
    taxRate: {
      name: 'Bangkok',
      amount: 0.07,
      includedInPrice: true,
      country: 'TH',
      state: 'Bangkok',
      id: 'opgU3dD5',
      subRates: [],
    },
    taxCategory: {
      typeId: 'tax-category',
      id: 'fb18160d-f163-4d67-9e9c-f657653fdf25',
    },
    deliveries: [],
    shippingMethod: {
      typeId: 'shipping-method',
      id: '754adb17-e505-41c7-b194-89925d608c20',
    },
    taxedPrice: {
      totalNet: {
        type: 'centPrecision',
        currencyCode: 'THB',
        centAmount: 6449,
        fractionDigits: 2,
      },
      totalGross: {
        type: 'centPrecision',
        currencyCode: 'THB',
        centAmount: 6900,
        fractionDigits: 2,
      },
      taxPortions: [
        {
          rate: 0.07,
          amount: {
            type: 'centPrecision',
            currencyCode: 'THB',
            centAmount: 451,
            fractionDigits: 2,
          },
          name: 'Bangkok',
        },
      ],
      totalTax: {
        type: 'centPrecision',
        currencyCode: 'THB',
        centAmount: 451,
        fractionDigits: 2,
      },
    },
    shippingMethodState: 'MatchesCart',
  },
  shippingAddress: {
    firstName: 'Somchai',
    lastName: 'Suwan',
    streetName: 'Sukhumvit Road',
    postalCode: '10110',
    city: 'Khlong Toei',
    state: 'Bangkok',
    country: 'TH',
    building: 'Suwan Tower',
    phone: '081-234-5678',
    email: 'somchai.suwan@example.com',
    custom: {
      type: {
        typeId: 'type',
        id: '4c50d579-81d6-48bb-9b1c-6bbb1ab1080b',
      },
      fields: {
        soi: 'Soi 11',
        village: 'Suwan Village',
        floor: '10',
        moo: '2',
        houseNo: '123/45',
        roomNo: '1010',
        subDistrict: 'Phra Khanong',
      },
    },
  },
  shipping: [],
  customLineItems: [],
  discountCodes: [],
  directDiscounts: [],
  custom: {
    type: { typeId: 'type', id: '6f5ebb53-b59e-4cb1-bd94-8469a4e8629e' },
    fields: { campaignGroup: 'mass', journey: 'device_only' },
  },
  inventoryMode: 'ReserveOnOrder',
  taxMode: 'Platform',
  taxRoundingMode: 'HalfEven',
  taxCalculationMode: 'LineItemLevel',
  deleteDaysAfterLastModification: 1,
  refusedGifts: [],
  origin: 'Customer',
  billingAddress: {
    firstName: 'Somchai',
    lastName: 'Suwan',
    streetName: 'Sukhumvit Road',
    postalCode: '10110',
    city: 'Khlong Toei',
    state: 'Bangkok',
    country: 'TH',
    building: 'Suwan Tower',
    phone: '081-234-5678',
    email: 'somchai.suwan@example.com',
    custom: {
      type: {
        typeId: 'type',
        id: '4c50d579-81d6-48bb-9b1c-6bbb1ab1080b',
      },
      fields: {
        taxInvoice: 'individual',
        soi: 'Soi 11',
        village: 'Suwan Village',
        floor: '10',
        moo: '2',
        thaiID: '1103700123456',
        houseNo: '123/45',
        roomNo: '1010',
        subDistrict: 'Phra Khanong',
      },
    },
  },
  itemShippingAddresses: [],
  totalLineItemQuantity: 2,
};
