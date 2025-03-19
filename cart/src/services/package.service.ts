// product-shelf/src/services/product.service.ts

import { Product, ProductPagedQueryResponse } from '@commercetools/platform-sdk';
import CommercetoolsProductClient from '../adapters/ct-product-client';
import { createStandardizedError } from '../utils/error.utils';

export class PackageService {
    async getPackageByCode(id: string, queryParams: any): Promise<Product> {
        try {
            return await CommercetoolsProductClient.getProductById(id, queryParams);
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'getPackageById');
        }
    }

    async getPackageById(id: string, queryParams: any): Promise<Product> {
        try {
            return await CommercetoolsProductClient.getProductById(id, queryParams);
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }

            throw createStandardizedError(error, 'getPackageById');
        }
    }

    async queryPackages(queryParams: any): Promise<ProductPagedQueryResponse> {
        try {
            return await CommercetoolsProductClient.queryProducts(queryParams);
        } catch (error: any) {
            if (error.status && error.message) {
                throw error;
            }
            throw createStandardizedError(error, 'queryPackages');
        }
    }
}