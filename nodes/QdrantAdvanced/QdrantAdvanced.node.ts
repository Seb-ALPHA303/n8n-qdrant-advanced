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
            'Array of point objects: { ID, vector: [...], payload: {...} }. Supports expressions.',
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
          typeOptions: { minValue: 1},
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
          // Parameter validation for required fields
          if (!collection) {
            throw new NodeOperationError(this.getNode(), 'Collection Name is required', { itemIndex: i });
          }
          switch (operation) {
            case 'createCollection': {
              const cfg = this.getNodeParameter('collectionConfig', i) as any;
              if (!cfg || (typeof cfg === 'string' && cfg.trim() === '')) {
                throw new NodeOperationError(this.getNode(), 'Collection Config is required for createCollection', { itemIndex: i });
              }
              response = await client.createCollection(collection, typeof cfg === 'string' ? JSON.parse(cfg) : cfg);
              break;
            }
            case 'updateCollection': {
              const cfgUpd = this.getNodeParameter('collectionConfig', i) as any;
              if (!cfgUpd || (typeof cfgUpd === 'string' && cfgUpd.trim() === '')) {
                throw new NodeOperationError(this.getNode(), 'Collection Config is required for updateCollection', { itemIndex: i });
              }
              response = await client.updateCollection(collection, typeof cfgUpd === 'string' ? JSON.parse(cfgUpd) : cfgUpd);
              break;
            }
            case 'getPoints': {
              const ids = this.getNodeParameter('pointIds', i) as any;
              if (!ids || (typeof ids === 'string' && ids.trim() === '')) {
                throw new NodeOperationError(this.getNode(), 'Point IDs are required for getPoints', { itemIndex: i });
              }
              response = await client.retrieve(collection, typeof ids === 'string' ? JSON.parse(ids) : ids);
              break;
            }
            case 'deletePoints': {
              const idsDel = this.getNodeParameter('pointIds', i) as any;
              if (!idsDel || (typeof idsDel === 'string' && idsDel.trim() === '')) {
                throw new NodeOperationError(this.getNode(), 'Point IDs are required for deletePoints', { itemIndex: i });
              }
              response = await client.delete(collection, typeof idsDel === 'string' ? JSON.parse(idsDel) : idsDel);
              break;
            }
            case 'upsertPoints': {
              const pts = this.getNodeParameter('points', i) as any;
              if (!pts || (typeof pts === 'string' && pts.trim() === '')) {
                throw new NodeOperationError(this.getNode(), 'Points are required for upsertPoints', { itemIndex: i });
              }
              response = await client.upsert(collection, {
                points: typeof pts === 'string' ? JSON.parse(pts) : pts,
              });
              break;
            }
            case 'updatePoints': {
              const ptsUpd = this.getNodeParameter('points', i) as any;
              if (!ptsUpd || (typeof ptsUpd === 'string' && ptsUpd.trim() === '')) {
                throw new NodeOperationError(this.getNode(), 'Points are required for updatePoints', { itemIndex: i });
              }
              response = await client.upsert(collection, {
                points: typeof ptsUpd === 'string' ? JSON.parse(ptsUpd) : ptsUpd,
              });
              break;
            }
            case 'searchPoints': {
              const vector = this.getNodeParameter('searchVector', i) as any;
              const limit = this.getNodeParameter('limit', i) as number;
              if (!vector || (typeof vector === 'string' && vector.trim() === '')) {
                throw new NodeOperationError(this.getNode(), 'Search Vector is required for searchPoints', { itemIndex: i });
              }
              if (!limit || limit < 1) {
                throw new NodeOperationError(this.getNode(), 'Limit must be at least 1 for searchPoints', { itemIndex: i });
              }
              const filter = this.getNodeParameter('filter', i) as any;
              response = await client.search(collection, {
                vector: typeof vector === 'string' ? JSON.parse(vector) : vector,
                filter: filter && (typeof filter === 'string' ? JSON.parse(filter) : filter),
                limit,
              });
              break;
            }
            // No extra validation needed for these:
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
            case 'countPoints': {
              const filter = this.getNodeParameter('filter', i) as any;
              response = await client.count(collection, typeof filter === 'string' ? JSON.parse(filter) : filter);
              break;
            }
            default:
              throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, { itemIndex: i });
          }
        } catch (e) {
          if (e instanceof NodeOperationError) {
            throw e;
          }
          throw new NodeApiError(this.getNode(), e);
        }
  
        returnData.push({ json: response });
      }
  
      // helpers.returnJsonArray returns INodeExecutionData[][]
      return [returnData];
    }
  }
  