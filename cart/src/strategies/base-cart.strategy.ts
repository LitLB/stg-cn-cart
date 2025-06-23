import { Cart } from '@commercetools/platform-sdk';
import { IAdapter, AdapterConstructor } from '../interfaces/adapter.interface';
import { ICartStrategy } from '../interfaces/cart';

export class BaseCartStrategy<T extends Record<string, IAdapter>> implements ICartStrategy {
 
  protected adapters: T = {} as T;

  constructor(...args: Array<AdapterConstructor<keyof T & string, T[keyof T & string]>>) {
      args.forEach((arg) => {
        const adapter = new arg();
        this.adapters[adapter.name as keyof T & string] = adapter;
      });
  }

  set accessToken(value: string) {
    throw Error('Method not implemented');
  }

  public addItem(cart: Cart, payload: any, header?: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  public removeItem(cart: Cart, body: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  public updateItem(cart: Cart, body: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  public bulkRemoveItems(cart: Cart, body: any): Promise<any> {
    throw new Error('Method not implemented');
  }

  public selectItem(cart: Cart, body: any): Promise<any> {
    throw new Error('Method not implemented');
  }
}
