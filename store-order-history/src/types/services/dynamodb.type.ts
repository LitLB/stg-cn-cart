import { AttributeValue } from "@aws-sdk/client-dynamodb"

export type ScanItemsInput = {
    tableName: string
    filterExpression: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, any>
}

export type QueryCommandInput = {
    tableName: string
    indexName: string
    keyConditionExpression: string
    expressionAttributeNames?: Record<string, string>
    expressionAttributeValues?: Record<string, any>
}

export type ScanItemResult = {
    Count: number
    Items: Record<string, AttributeValue>[]
    ScannedCount: number
}

export type PutItemInput = {
    tableName: string
    item: Record<string, AttributeValue>
}
