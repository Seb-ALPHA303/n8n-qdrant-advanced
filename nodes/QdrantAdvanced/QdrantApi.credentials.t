import { ICredentialType, NodePropertyTypes } from 'n8n-workflow';

export class QdrantApi implements ICredentialType {
  name = 'qdrantApi';
  displayName = 'Qdrant API';
  properties = [
    {
      displayName: 'URL',
      name: 'url',
      type: 'string' as NodePropertyTypes,
      default: 'http://localhost:6333',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string' as NodePropertyTypes,
      default: '',
    },
  ];
}
