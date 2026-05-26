/**
 * Type definitions for Postrack Collection API Docs response.
 * These mirror the shape returned by Postrack's public collection docs endpoint.
 */

export interface ApiDocEndpointParam {
  name: string;
  in: string;
  required: boolean;
  description: string;
  schema: any;
}

export interface ApiDocEndpointParamSchema {
  name: string;
  dataType: string;
  required: boolean;
  exampleValue: string;
  description: string;
  in: string;
}

export interface ApiDocEndpointResponseExample {
  name: string;
  headers?: Record<string, string>;
  body?: any;
}

export interface ApiDocEndpointResponse {
  description: string;
  examples?: ApiDocEndpointResponseExample[];
}

export interface ApiDocEndpointAuth {
  type: string;
  credentials?: Record<string, string>;
}

export interface ApiDocEndpoint {
  id: string;
  name: string;
  method: string;
  url: string;
  path: string;
  cleanPath: string;
  summary: string;
  description: string;
  notes: string | null;
  tags: string[];
  parameters: ApiDocEndpointParam[];
  paramSchema: ApiDocEndpointParamSchema[] | null;
  requestBody: {
    description: string;
    content: Record<string, any>;
  } | null;
  responses: Record<string, ApiDocEndpointResponse>;
  headers: Record<string, string> | null;
  auth: ApiDocEndpointAuth | null;
  curlExample: string | null;
}

export interface ApiDocFolder {
  id: string;
  name: string;
  order: number;
  children: ApiDocFolder[];
  requests: ApiDocEndpoint[];
}

export interface ApiDocCollection {
  id: string;
  name: string;
  description: string | null;
  docMode: string;
  baseUrl: string | null;
}

export interface ApiDocBlock {
  id: string;
  type: string;
  content: any;
  order: number;
  folderId: string | null;
  requestId: string | null;
}

export interface ApiDocsStats {
  totalEndpoints: number;
  methods: Record<string, number>;
}

export interface CollectionDocsResponse {
  collection: ApiDocCollection;
  endpoints: ApiDocEndpoint[];
  folders: ApiDocFolder[];
  tags: string[];
  stats: ApiDocsStats;
  docBlocks: ApiDocBlock[];
}
