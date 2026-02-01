export interface ConfigDefinition {
    gatewayApiUrl: string;
}

const ConfigurationHelper: ConfigDefinition = {
    // gatewayApiUrl: (window as any)['config'].gatewayApiUrl || 'https:localhost:5111'
    gatewayApiUrl: 'https://localhost:7104/api'

}

export default ConfigurationHelper;