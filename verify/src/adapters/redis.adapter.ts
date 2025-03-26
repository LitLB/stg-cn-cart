import { createClient, RedisClientType } from 'redis';

export class RedisAdapter {
    private client: RedisClientType | null = null;

    public async connectRedis(): Promise<RedisClientType> {
        if (this.client) {
            return this.client;
        }

        this.client = createClient();
        this.client.on('error', (err) => console.error('Redis Client Error:', err));

        try {
            await this.client.connect();
            console.log('Connected to Redis successfully.');
        } catch (error) {
            console.error('Error connecting to Redis:', error);
            throw error;
        }

        return this.client;
    }

    public async set(key: string, value: string, ttl?: number): Promise<void> {
        try {

            const client = await this.connectRedis();
            if (ttl) {
                await client.set(key, value, { EX: ttl });
            } else {
                await client.set(key, value);
            }
        } catch (e: any) {
            console.log('Redis set error:', e);
            throw {
                statusCode: '500.1010',
                statusMessage: 'Error inserting data into Redis',
            }
        }
    }

    public async get(key: string): Promise<string | null> {
        const client = await this.connectRedis();
        return client.get(key);
    }

    public async update(key: string, value: string, ttl?: number): Promise<void> {

        const existingKey = await this.get(key)

        if (!existingKey) {
            if (ttl) {
                await this.set(key, value)
            } else {
                await this.set(key, value, ttl)
            }
        } else {
            await this.set(existingKey, value, ttl);
        }

    }
}