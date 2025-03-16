import { Cart } from "@commercetools/platform-sdk";
import { IAdapter } from "../interfaces/adapter.interface";
import { ICartStrategy } from "../interfaces/cart";

export class BaseCartStrategy implements ICartStrategy {
    protected adapters: Record<string, any> = {}

    constructor(...args: (new () => IAdapter)[]) {
        args.forEach((arg) => {
            const adapter = new arg()
            this.adapters[adapter.name] = adapter
        })
    }

    set accessToken(value: string) {
        throw Error('Method not implemented')
    }

    public addItem(cart: Cart, payload: any): Promise<any> {
        throw new Error('Method not implemented')
    }

    public removeItem(cart: Cart, body: any): Promise<any> {
        throw new Error('Method not implemented')
    }

    public updateItem(cart: Cart, body: any): Promise<any> {
        throw new Error('Method not implemented')
    }

    public bulkRemoveItems(cart: Cart, body: any): Promise<any> {
        throw new Error('Method not implemented')
    }

    public selectItem(cart: Cart, body: any): Promise<any> {
        throw new Error('Method not implemented')
    }
}