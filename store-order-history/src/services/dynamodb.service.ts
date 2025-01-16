import {
    DynamoDBClient,
    ScanCommand,
    PutItemCommand,
} from '@aws-sdk/client-dynamodb'
import { readConfiguration } from '../utils/config.utils'
import { PutItemInput, ScanItemsInput } from '../types/services/dynamodb.type'
import { logger } from '../utils/logger.utils'

const dynamodbClient = (): DynamoDBClient => {
    const client = new DynamoDBClient({
        region: readConfiguration().dynamodb.region as string,
        credentials: {
            accessKeyId: readConfiguration().dynamodb.accessKeyId as string,
            secretAccessKey: readConfiguration().dynamodb
                .secretAccessKey as string,
        },
    })

    return client
}

export const scanItems = async <T>({
    tableName,
    filterExpression,
    expressionAttributeNames,
    expressionAttributeValues,
}: ScanItemsInput): Promise<T[] | null> => {
    try {
        const params = {
            TableName: tableName,
            FilterExpression: filterExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }

        const command = new ScanCommand(params)
        const response = await client.send(command)
        if (!response || !response.Items) {
            return null
        }

        return response.Items as T[]
    } catch (err: any) {
        logger.error(err)
        return null
    }
}

export const putItem = async ({ tableName, item }: PutItemInput) => {
    try {
        const putItemCommand = new PutItemCommand({
            TableName: tableName,
            Item: item,
            ReturnConsumedCapacity: 'TOTAL',
        })
        
        const response = await client.send(putItemCommand)
        return response
    } catch (err: any) {
        logger.error(err)
        return null
    }
}

export const client = dynamodbClient()
