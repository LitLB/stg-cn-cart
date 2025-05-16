import axios from 'axios'
import { readConfiguration } from "../utils/config.utils";
import hlMocks from './hl-mocks.json'

class HeadlessClientAdapter {
    private readonly client: any
    private readonly hlConfig: any
    private accessToken: any
    private readonly config: any
    constructor() {
        this.hlConfig = readConfiguration().hl
        this.client = axios.create({ baseURL: this.hlConfig.baseUrl })
        this.config = readConfiguration()
    }

    async init() {
        const { accessToken } = await this.getToken()
        this.accessToken = accessToken
    }

    async getToken(): Promise<any> {
       return ""
    }

    preVerify(thaiId: string): Record<string, unknown>{
        return (hlMocks as Record<string, unknown>)[thaiId] as Record<string, unknown>
    }
}

export const hlClientAdapter = new HeadlessClientAdapter();

export default HeadlessClientAdapter