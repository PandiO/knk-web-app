import { appConfig } from '../config/appConfig';

export interface ConfigDefinition {
    gatewayApiUrl: string;
}

const ConfigurationHelper: ConfigDefinition = {
    // gatewayApiUrl: (window as any)['config'].gatewayApiUrl || 'https:localhost:5111'
    gatewayApiUrl: appConfig.api.baseUrl

}

export default ConfigurationHelper;