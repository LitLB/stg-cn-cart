export interface Config {
  clientId: string;
  clientSecret: string;
  projectKey: string;
  scope: string;
  region: string;
  port: string;
}

export interface ResponseCounter {
  counterACN1?: number 
  counter953?: number 
}

export interface ResponseService {
  statusCode?: number 
  success?: number 
  response?: string | ResponseCounter| unknown
}
