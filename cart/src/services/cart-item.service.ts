import { Cart } from '@commercetools/platform-sdk';
import { ICartStrategy } from '../interfaces/cart';

export class CartItemService<T extends ICartStrategy> {
    private cartStrategy: T

    constructor(strategy: new() => T,) {
        this.cartStrategy = new strategy()
    }

    private set accessToken(value: string) {
        this.cartStrategy.accessToken = value
    }

    public async addItem(accessToken: string, cart: Cart, payload: any, headers?: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.addItem(cart, payload, headers)
    }

    public async updateItemQuantityById(accessToken: string, cart: Cart, body: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.updateItem(cart, body)
    }

    public async deleteItemById(accessToken: string, cart: Cart, body: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.removeItem(cart, body)
    }

    public async bulkDelete(accessToken: string, cart: Cart, body: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.bulkRemoveItems(cart, body)
    }

    public async select(accessToken: string, cart: Cart, body: any): Promise<any> {
        this.accessToken = accessToken
        return this.cartStrategy.selectItem(cart, body)
    }
}
