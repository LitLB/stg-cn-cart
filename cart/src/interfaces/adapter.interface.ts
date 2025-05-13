export interface IAdapter {
    name: string
}

export type AdapterConstructor<N extends string, T extends IAdapter & { name: N }> = new () => T;