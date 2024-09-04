import { ApiClient, IntegrationApi } from 'talon_one'
import { logger } from '../utils/logger.utils'
import { talonOneConfig } from '../utils/config.utils'

export const syncCartItemCatalog = async (payload: any) => {
    const client = getTalonOneApiClient()
    return await client.syncCatalog(talonOneConfig().catalogId, payload)
        .catch((error: any) => {
            logger.error('Sync cart item catalog error', error)
        })
}

const getTalonOneApiClient = () => {
    const apiClient = new ApiClient()
    apiClient.basePath = talonOneConfig().url

    // @ts-ignore this is a bug in the talon one types
    const apiKeyV1 = apiClient.authentications.api_key_v1
    apiKeyV1.apiKey = talonOneConfig().apiKey
    apiKeyV1.apiKeyPrefix = talonOneConfig().apiKeyPrefix

    return new IntegrationApi(apiClient)
}