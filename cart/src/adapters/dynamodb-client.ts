import { 
    DynamoDBClient, 
    GetItemCommand, 
    GetItemCommandInput, 
    PutItemCommand, 
    PutItemCommandInput, 
    QueryCommand,
    ScanCommand, 
    ScanCommandOutput} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { readConfiguration } from '../utils/config.utils';
import { logger } from "../utils/logger.utils";

export interface ScanCommandInput {
    tableName: string;
    filterExpression: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, any>;
}

export interface QueryCommandInput {
    tableName: string;
    indexName: string;
    keyConditionExpression: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, any>;
}

export class dynamoDB {
    constructor(
        private readonly dynamoDBClient = new DynamoDBClient({ 
            region: readConfiguration().dynamodb.region as string,
            credentials: {
                accessKeyId: readConfiguration().dynamodb.accessKeyId as string,
                secretAccessKey: readConfiguration().dynamodb.secretAccessKey as string,
            }
        })
    ) {}

    public async findByKey(table = '', key: object): Promise<null | any> {
        try {
            if (!table) return null

            const input: GetItemCommandInput = { 
                TableName: table, 
                Key: marshall(key)
            }
            const client = this.dynamoDBClient
            const command = new GetItemCommand(input)
            const response = await client.send(command)

            if (!response?.Item) return null

            return unmarshall(response?.Item)
        } catch (err) {
            logger.error(err)
            return null
        }
    }

    public async scanItem({
        tableName,
        filterExpression,
        expressionAttributeNames,
        expressionAttributeValues,
      }: ScanCommandInput): Promise<null | ScanCommandOutput> {
        try {
            const params = {
                TableName: tableName,
                FilterExpression: filterExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues,
            }

            const client = this.dynamoDBClient
            const command = new ScanCommand(params)
            const response = await client.send(command)
            return response
        } catch (err) {
            console.log(err)
            return null
        }
    }

    public async queryCommand({
        tableName,
        indexName,
        keyConditionExpression,
        expressionAttributeNames,
        expressionAttributeValues,
      }: QueryCommandInput): Promise<null | any> {
        try {

            const params = {
                TableName: tableName,
                IndexName: indexName,
                KeyConditionExpression: keyConditionExpression,
                ExpressionAttributeNames: expressionAttributeNames,
                ExpressionAttributeValues: expressionAttributeValues
              };

            const client = this.dynamoDBClient
            const command = new QueryCommand(params)
            const response = await client.send(command)

            return response
        } catch (err) {
            console.log(err)
            return null
        }
    }

    public async insertData(tableName: string, item: Record<string, any>): Promise<void> {
        const params: PutItemCommandInput = {
            TableName: tableName,
            Item: marshall(item),
        };

        try {
            const command = new PutItemCommand(params);
            await this.dynamoDBClient.send(command);
            logger.info(`Successfully inserted item into ${tableName}`);
        } catch (error) {
            logger.error(`Failed to insert item into ${tableName}`, error);
            throw error;
        }
    }


}

export const dynamoClient = new dynamoDB()