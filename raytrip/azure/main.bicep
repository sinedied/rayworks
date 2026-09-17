targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the the environment which is used to generate a short unique hash used in all resources.')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('The object ID of the principal running azd.')
param principalId string

@description('The Microsoft Entra principal type of the azd deployer.')
@allowed([
  'User'
  'Group'
  'ServicePrincipal'
])
param principalType string = 'User'

@description('The model catalog name to deploy.')
param modelName string = 'gpt-5.6-luna'

@description('The model catalog version to deploy.')
param modelVersion string = '2026-07-09'

@description('The deployment name used by inference requests.')
param modelDeploymentName string = 'gpt-5.6-luna'

@description('The model deployment SKU. Availability depends on the selected region.')
param modelDeploymentSku string = 'GlobalStandard'

@description('The model deployment capacity. Quota requirements depend on the model and region.')
@minValue(1)
param modelDeploymentCapacity int = 10

@description('Optional object ID of an Entra group or service principal that should invoke the model.')
param inferencePrincipalId string = ''

@description('The type of the optional inference principal.')
@allowed([
  'Group'
  'ServicePrincipal'
  'User'
])
param inferencePrincipalType string = 'Group'

param resourceGroupName string = ''

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var normalizedEnvironmentName = take(toLower(replace(environmentName, '-', '')), 32)
var accountName = 'ai${normalizedEnvironmentName}${resourceToken}'
var openAiUserRole = 'Cognitive Services OpenAI User'
var deployerRoleAssignment = {
  principalId: principalId
  principalType: principalType
  roleDefinitionIdOrName: openAiUserRole
}
var inferenceRoleAssignments = empty(inferencePrincipalId)
  ? []
  : [
      {
        principalId: inferencePrincipalId
        principalType: inferencePrincipalType
        roleDefinitionIdOrName: openAiUserRole
      }
    ]

resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: !empty(resourceGroupName) ? resourceGroupName : 'rg-${environmentName}'
  location: location
}

module foundry 'br/public:avm/res/cognitive-services/account:0.19.0' = {
  name: 'foundry-${resourceToken}'
  scope: resourceGroup
  params: {
    name: accountName
    kind: 'AIServices'
    sku: 'S0'
    location: location
    customSubDomainName: accountName
    allowProjectManagement: true
    disableLocalAuth: true
    publicNetworkAccess: 'Enabled'
    roleAssignments: concat([deployerRoleAssignment], inferenceRoleAssignments)
    tags: {
      'azd-env-name': environmentName
      application: 'raytrip'
    }
    deployments: [
      {
        name: modelDeploymentName
        model: {
          format: 'OpenAI'
          name: modelName
          version: modelVersion
        }
        sku: {
          name: modelDeploymentSku
          capacity: modelDeploymentCapacity
        }
      }
    ]
  }
}

output AZURE_AI_FOUNDRY_ACCOUNT_NAME string = foundry.outputs.name
output AZURE_AI_FOUNDRY_ACCOUNT_ID string = foundry.outputs.resourceId
output AZURE_AI_FOUNDRY_ENDPOINT string = foundry.outputs.endpoint
output AZURE_AI_MODEL_DEPLOYMENT_NAME string = modelDeploymentName
output AZURE_FOUNDRY_ENDPOINT string = 'https://${accountName}.openai.azure.com/openai/v1/'
