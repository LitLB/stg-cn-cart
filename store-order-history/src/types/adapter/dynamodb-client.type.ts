export type ScanCommandInput = {
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