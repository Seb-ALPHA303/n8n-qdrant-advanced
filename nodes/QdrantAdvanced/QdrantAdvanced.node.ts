import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeApiError,
    NodeOperationError,
  } from 'n8n-workflow';
  import { QdrantClient } from '@qdrant/js-client-rest';
  
  export class QdrantAdvanced implements INodeType {
    description: INodeTypeDescription = {
      displayName: 'Qdrant (Advanced)',
      name: 'qdrantAdvanced',
      icon: 'file:qdrant.svg',
      group: ['input'],
      version: 1,
      subtitle: '={{$parameter["operation"] + ": " + $parameter["collectionName"]}}',
      description: 'Full Qdrant API — collections & points, with JSON expressions everywhere',
      defaults: {
        name: 'Qdrant (Advanced)',
      },
      inputs: ['main'],
      outputs: ['main'],
      credentials: [
        {
          name: 'qdrantApi',
          required: true,
        },
      ],
      properties: [
        {
          displayName: 'Operation',
          name: 'operation',
          type: 'options',
          noDataExpression: true,
          options: [
            { name: 'Count Points', value: 'countPoints' },
            { name: 'Create Collection', value: 'createCollection' },
            { name: 'Delete Collection', value: 'deleteCollection' },
            { name: 'Delete Points', value: 'deletePoints' },
            { name: 'Get Collection Info', value: 'getCollection' },
            { name: 'Get Points by IDs', value: 'getPoints' },
            { name: 'List Collections', value: 'listCollections' },
            { name: 'Search Points', value: 'searchPoints' },
            { name: 'Update Collection', value: 'updateCollection' },
            { name: 'Update Points', value: 'updatePoints' },
            { name: 'Upsert Points', value: 'upsertPoints' },
          ],
          default: 'searchPoints',
        },
        {
          displayName: 'Collection Name',
          name: 'collectionName',
          type: 'string',
          default: '',
          required: true,
          description: 'The Qdrant collection to operate on (expressions supported)',
        },
        {
          displayName: 'Collection Config (JSON)',
          name: 'collectionConfig',
          type: 'json',
          typeOptions: { alwaysOpenEditWindow: true },
          default: '{}',
          displayOptions: {
            show: {
              operation: ['createCollection','updateCollection'],
            },
          },
          description:
            'Raw Qdrant collection config (vectors, replication_factor, etc). Expressions like {{$fromAI(...)}} work.',
        },
        {
          displayName: 'Point IDs (JSON Array)',
          name: 'pointIds',
          type: 'json',
          typeOptions: { alwaysOpenEditWindow: true },
          default: '[]',
          displayOptions: {
            show: {
              operation: ['getPoints','deletePoints'],
            },
          },
          description: 'Array of point IDs, e.g. [1,2,3]. Supports expressions.',
        },
        {
          displayName: 'Points (JSON Array)',
          name: 'points',
          type: 'json',
          typeOptions: { alwaysOpenEditWindow: true },
          default: '[]',
          displayOptions: {
            show: {
              operation: ['upsertPoints','updatePoints'],
            },
          },
          description:
            'Array of point objects: { id, vector: [...], payload: {...} }. Supports expressions.',
        },
        {
          displayName: 'Search Vector (JSON Array)',
          name: 'searchVector',
          type: 'json',
          typeOptions: { alwaysOpenEditWindow: true },
          default: '[]',
          displayOptions: {
            show: { operation: ['searchPoints'] },
          },
          description:
            'Embedding vector to search against. Or leave blank to use incoming data.',
        },
        {
          displayName: 'Filter (JSON)',
          name: 'filter',
          type: 'json',
          typeOptions: { alwaysOpenEditWindow: true },
          default: '{}',
          displayOptions: {
            show: { operation: ['searchPoints','countPoints'] },
          },
          description: 'Qdrant filter object. Expressions supported.',
        },
        {
          displayName: 'Limit',
          name: 'limit',
          type: 'number',
          default: 50,
          typeOptions: { minValue: 1, maxValue: 1000 },
          displayOptions: {
            show: { operation: ['searchPoints'] },
          },
          description: 'Max number of results to return',
        },
      ],
    };
  
    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
      const items = this.getInputData();
      const returnData: INodeExecutionData[] = [];
  
      // Properly cast credentials
      const creds = this.getCredentials('qdrantApi') as unknown as {
        url: string;
        apiKey?: string;
      };
      const client = new QdrantClient({
        url: creds.url,
        apiKey: creds.apiKey,
      });
  
      for (let i = 0; i < items.length; i++) {
        const operation = this.getNodeParameter('operation', i) as string;
        const collection = this.getNodeParameter('collectionName', i) as string;
        let response: any;
  
        try {
          switch (operation) {
            case 'createCollection': {
              const cfg = this.getNodeParameter('collectionConfig', i) as any;
              response = await client.createCollection(collection, typeof cfg === 'string' ? JSON.parse(cfg) : cfg);
              break;
            }
            case 'deleteCollection':
              await client.deleteCollection(collection);
              response = { success: true };
              break;
            case 'listCollections':
              response = await client.getCollections();
              break;
            case 'getCollection':
              response = await client.getCollection(collection);
              break;
            case 'updateCollection': {
              const cfgUpd = this.getNodeParameter('collectionConfig', i) as any;
              response = await client.updateCollection(collection, typeof cfgUpd === 'string' ? JSON.parse(cfgUpd) : cfgUpd);
              break;
            }
            case 'countPoints': {
              const filter = this.getNodeParameter('filter', i) as any;
              response = await client.count(collection, typeof filter === 'string' ? JSON.parse(filter) : filter);
              break;
            }
            case 'getPoints': {
              const ids = this.getNodeParameter('pointIds', i) as any;
              response = await client.retrieve(collection, typeof ids === 'string' ? JSON.parse(ids) : ids);
              break;
            }
            case 'searchPoints': {
              const vector = this.getNodeParameter('searchVector', i) as any;
              const filter = this.getNodeParameter('filter', i) as any;
              const limit = this.getNodeParameter('limit', i) as number;
              response = await client.search(collection, {
                vector: typeof vector === 'string' ? JSON.parse(vector) : vector,
                filter: filter && (typeof filter === 'string' ? JSON.parse(filter) : filter),
                limit,
              });
              break;
            }
            case 'upsertPoints': {
              const pts = this.getNodeParameter('points', i) as any;
              response = await client.upsert(collection, {
                points: typeof pts === 'string' ? JSON.parse(pts) : pts,
              });
              break;
            }
            case 'updatePoints': {
              // Qdrant upsert is idempotent and will update if the point exists
              const ptsUpd = this.getNodeParameter('points', i) as any;
              response = await client.upsert(collection, {
                points: typeof ptsUpd === 'string' ? JSON.parse(ptsUpd) : ptsUpd,
              });
              break;
            }
            case 'deletePoints': {
              const idsDel = this.getNodeParameter('pointIds', i) as any;
              // Pass the ids array directly
              response = await client.delete(collection, typeof idsDel === 'string' ? JSON.parse(idsDel) : idsDel);
              break;
            }
            default:
              throw new Error(`Unsupported operation "${operation}"`);
          }
        } catch (e) {
          throw new NodeApiError(this.getNode(), e);
        }
  
        returnData.push({ json: response });
      }
  
      // helpers.returnJsonArray returns INodeExecutionData[][]
      return [returnData];
    }
  }
  