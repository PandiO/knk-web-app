export interface ConfigDefinition {
    gatewayApiUrl: string;
}

const ConfigurationHelper: ConfigDefinition = {
    // gatewayApiUrl: (window as any)['config'].gatewayApiUrl || 'https:localhost:5111'
    gatewayApiUrl: 'http://localhost:5111/api'

}

export default ConfigurationHelper;