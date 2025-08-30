import { MCPRequest, MCPResponse, ToolDefinition } from '../types/mcp.js';
import { SessionData } from '../types/session.js';
import * as pipedrive from "pipedrive";
import * as dotenv from 'dotenv';

// Helper function for error handling
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// Pipedrive API clients - will be initialized in the constructor
let dealsApi: pipedrive.DealsApi;
let personsApi: pipedrive.PersonsApi;
let organizationsApi: pipedrive.OrganizationsApi;
let pipelinesApi: pipedrive.PipelinesApi;
let itemSearchApi: pipedrive.ItemSearchApi;
let leadsApi: pipedrive.LeadsApi;

export class MCPHandler {
  constructor(pipedriveApiToken: string) {
    if (!pipedriveApiToken) {
      throw new Error("PIPEDRIVE_API_TOKEN is required for MCPHandler");
    }

    const apiClient = new pipedrive.ApiClient();
    apiClient.authentications = apiClient.authentications || {};
    apiClient.authentications['api_key'] = {
      type: 'apiKey',
      'in': 'query',
      name: 'api_token',
      apiKey: pipedriveApiToken
    };

    dealsApi = new pipedrive.DealsApi(apiClient);
    personsApi = new pipedrive.PersonsApi(apiClient);
    organizationsApi = new pipedrive.OrganizationsApi(apiClient);
    pipelinesApi = new pipedrive.PipelinesApi(apiClient);
    itemSearchApi = new pipedrive.ItemSearchApi(apiClient);
    leadsApi = new pipedrive.LeadsApi(apiClient);
  }

  private tools: ToolDefinition[] = [
    { name: "get-deals", description: "Get all deals from Pipedrive including custom fields", inputSchema: { type: "object", properties: {}, required: [] } },
    { name: "get-deal", description: "Get a specific deal by ID including custom fields", inputSchema: { type: "object", properties: { dealId: { type: "number", description: "Pipedrive deal ID" } }, required: ["dealId"] } },
    { name: "search-deals", description: "Search deals by term", inputSchema: { type: "object", properties: { term: { type: "string", description: "Search term for deals" } }, required: ["term"] } },
    { name: "get-persons", description: "Get all persons from Pipedrive including custom fields", inputSchema: { type: "object", properties: {}, required: [] } },
    { name: "get-person", description: "Get a specific person by ID including custom fields", inputSchema: { type: "object", properties: { personId: { type: "number", description: "Pipedrive person ID" } }, required: ["personId"] } },
    { name: "search-persons", description: "Search persons by term", inputSchema: { type: "object", properties: { term: { type: "string", description: "Search term for persons" } }, required: ["term"] } },
    { name: "get-organizations", description: "Get all organizations from Pipedrive including custom fields", inputSchema: { type: "object", properties: {}, required: [] } },
    { name: "get-organization", description: "Get a specific organization by ID including custom fields", inputSchema: { type: "object", properties: { organizationId: { type: "number", description: "Pipedrive organization ID" } }, required: ["organizationId"] } },
    { name: "search-organizations", description: "Search organizations by term", inputSchema: { type: "object", properties: { term: { type: "string", description: "Search term for organizations" } }, required: ["term"] } },
    { name: "get-pipelines", description: "Get all pipelines from Pipedrive", inputSchema: { type: "object", properties: {}, required: [] } },
    { name: "get-pipeline", description: "Get a specific pipeline by ID", inputSchema: { type: "object", properties: { pipelineId: { type: "number", description: "Pipedrive pipeline ID" } }, required: ["pipelineId"] } },
    { name: "get-stages", description: "Get all stages from Pipedrive", inputSchema: { type: "object", properties: {}, required: [] } },
    { name: "search-leads", description: "Search leads by term", inputSchema: { type: "object", properties: { term: { type: "string", description: "Search term for leads" } }, required: ["term"] } },
    { name: "search-all", description: "Search across all item types (deals, persons, organizations, etc.)", inputSchema: { type: "object", properties: { term: { type: "string", description: "Search term" }, itemTypes: { type: "string", description: "Comma-separated list of item types" } }, required: ["term"] } },
  ];

  async handleInitialize(request: MCPRequest, session: SessionData): Promise<MCPResponse> {
    session.initialized = true;
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: true }, resources: {}, prompts: {} },
        serverInfo: { name: "pipedrive-mcp-server", version: "1.0.2" }
      }
    };
  }

  async handleToolsList(request: MCPRequest): Promise<MCPResponse> {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: { tools: this.tools }
    };
  }

  async handleToolCall(request: MCPRequest): Promise<MCPResponse> {
    try {
      const { name, arguments: args } = request.params || {};
      const tool = this.tools.find(t => t.name === name);
      if (!tool) {
        return this.createErrorResponse(request.id, -32601, `Tool "${name}" not found`);
      }
      const result = await this.executeToolCall(name, args);
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: result
      };
    } catch (error) {
      return this.createErrorResponse(request.id, -32603, `Tool execution failed: ${getErrorMessage(error)}`);
    }
  }

  private async executeToolCall(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "get-deals": return (await dealsApi.getDeals()).data;
      case "get-deal": return (await dealsApi.getDeal({ id: args.dealId })).data;
      case "search-deals": return (await dealsApi.searchDeals({ term: args.term })).data;
      case "get-persons": return (await personsApi.getPersons()).data;
      case "get-person": return (await personsApi.getPerson({ id: args.personId })).data;
      case "search-persons": return (await personsApi.searchPersons({ term: args.term })).data;
      case "get-organizations": return (await organizationsApi.getOrganizations()).data;
      case "get-organization": return (await organizationsApi.getOrganization({ id: args.organizationId })).data;
      case "search-organizations": return (await organizationsApi.searchOrganizations({ term: args.term })).data;
      case "get-pipelines": return (await pipelinesApi.getPipelines()).data;
      case "get-pipeline": return (await pipelinesApi.getPipeline({ id: args.pipelineId })).data;
      case "search-leads": return (await leadsApi.searchLeads({ term: args.term })).data;
      case "search-all": return (await itemSearchApi.searchItem({ term: args.term, itemType: args.itemTypes })).data;
      case "get-stages":
        const pipelines = (await pipelinesApi.getPipelines()).data || [];
        const allStages = [];
        for (const pipeline of pipelines) {
          const stagesResponse = await fetch(`https://api.pipedrive.com/v1/stages?pipeline_id=${pipeline.id}&api_token=${process.env.PIPEDRIVE_API_TOKEN}`);
          const stagesData = await stagesResponse.json();
          if (stagesData.success && stagesData.data) {
            allStages.push(...stagesData.data.map((stage: any) => ({ ...stage, pipeline_name: pipeline.name })));
          }
        }
        return allStages;
      default: throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async processRequest(request: MCPRequest, session: SessionData): Promise<MCPResponse> {
    const { method } = request;
    switch (method) {
      case 'initialize': return this.handleInitialize(request, session);
      case 'tools/list': return this.handleToolsList(request);
      case 'tools/call': return this.handleToolCall(request);
      default: return this.createErrorResponse(request.id, -32601, `Method not found: ${method}`);
    }
  }

  private createErrorResponse(id: any, code: number, message: string): MCPResponse {
    return {
      jsonrpc: "2.0",
      id,
      error: { code, message }
    };
  }
}
