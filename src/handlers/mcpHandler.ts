import { MCPRequest, MCPResponse, ToolDefinition } from '../types/mcp.js';
import { SessionData } from '../types/session.js';
import * as pipedrive from "pipedrive";
import * as dotenv from 'dotenv';

// Helper function for error handling
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// Helper function to log Pipedrive API responses
async function logAndReturnData(apiCallName: string, apiPromise: Promise<any>): Promise<any> {
    try {
        const response = await apiPromise;
        console.log(`[Pipedrive API] Raw response for ${apiCallName}:`, JSON.stringify(response, null, 2));
        return response.data;
    } catch (error) {
        console.error(`[Pipedrive API] Error during ${apiCallName}:`, error);
        throw error;
    }
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
    { name: "get-deals", description: "Get all deals from Pipedrive including custom fields", inputSchema: { type: "object", properties: { message: { type: "string", description: "Get all deals from Pipedrive including custom fields" } }, required: [] } },
    { name: "get-deal", description: "Get a specific deal by ID including custom fields", inputSchema: { type: "object", properties: { dealId: { type: "number", description: "Pipedrive deal ID" } }, required: ["dealId"] } },
    { name: "search-deals", description: "Search deals by term", inputSchema: { type: "object", properties: { term: { type: "string", description: "Search term for deals" } }, required: ["term"] } },
    { name: "get-persons", description: "Get all persons from Pipedrive including custom fields", inputSchema: { type: "object", properties: { message: { type: "string", description: "Get all persons from Pipedrive including custom fields" } }, required: [] } },
    { name: "get-person", description: "Get a specific person by ID including custom fields", inputSchema: { type: "object", properties: { personId: { type: "number", description: "Pipedrive person ID" } }, required: ["personId"] } },
    { name: "search-persons", description: "Search persons by term", inputSchema: { type: "object", properties: { term: { type: "string", description: "Search term for persons" } }, required: ["term"] } },
    {
      name: "create-person",
      description: "Create a new person in Pipedrive.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "The name of the person." },
          email: { type: "string", description: "The email address of the person. Will be marked as 'work'." },
          phone: { type: "string", description: "The phone number of the person. Will be marked as 'work'." }
        },
        required: ["name"]
      }
    },
    { name: "get-organizations", description: "Get all organizations from Pipedrive including custom fields", inputSchema: { type: "object", properties: { message: { type: "string", description: "Get all organizations from Pipedrive including custom fields" } }, required: [] } },
    { name: "get-organization", description: "Get a specific organization by ID including custom fields", inputSchema: { type: "object", properties: { organizationId: { type: "number", description: "Pipedrive organization ID" } }, required: ["organizationId"] } },
    { name: "search-organizations", description: "Search organizations by term", inputSchema: { type: "object", properties: { term: { type: "string", description: "Search term for organizations" } }, required: ["term"] } },
    { name: "get-pipelines", description: "Get all pipelines from Pipedrive", inputSchema: { type: "object", properties: { message: { type: "string", description: "Get all pipelines from Pipedrive" } }, required: [] } },
    { name: "get-pipeline", description: "Get a specific pipeline by ID", inputSchema: { type: "object", properties: { pipelineId: { type: "number", description: "Pipedrive pipeline ID" } }, required: ["pipelineId"] } },
    { name: "get-stages", description: "Get all stages from Pipedrive", inputSchema: { type: "object", properties: { message: { type: "string", description: "Get all stages from Pipedrive" } }, required: [] } },
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

      const toolResultData = await this.executeToolCall(name, args);

      // Construct the specific response structure provided by the user
      const responseData = Array.isArray(toolResultData) ? toolResultData : [toolResultData];

      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          content: [
            {
              type: "object",
              data: responseData
            }
          ]
        }
      };
    } catch (error) {
      return this.createErrorResponse(request.id, -32603, `Tool execution failed: ${getErrorMessage(error)}`);
    }
  }

  private async executeToolCall(toolName: string, args: any): Promise<any> {
    switch (toolName) {
      case "get-deals": return logAndReturnData("get-deals", dealsApi.getDeals());
      case "get-deal": return logAndReturnData("get-deal", dealsApi.getDeal({ id: args.dealId }));
      case "search-deals": return logAndReturnData("search-deals", dealsApi.searchDeals({ term: args.term }));
      case "get-persons": return logAndReturnData("get-persons", personsApi.getPersons());
      case "get-person": return logAndReturnData("get-person", personsApi.getPerson({ id: args.personId }));
      case "search-persons": return logAndReturnData("search-persons", personsApi.searchPersons({ term: args.term }));
      case "create-person":
        const personData: any = { name: args.name };
        if (args.email) {
            personData.email = [{ value: args.email, primary: true, label: 'work' }];
        }
        if (args.phone) {
            personData.phone = [{ value: args.phone, primary: true, label: 'work' }];
        }
        return logAndReturnData("create-person", (personsApi as any).addPerson(personData));
      case "get-organizations": return logAndReturnData("get-organizations", organizationsApi.getOrganizations());
      case "get-organization": return logAndReturnData("get-organization", organizationsApi.getOrganization({ id: args.organizationId }));
      case "search-organizations": return logAndReturnData("search-organizations", organizationsApi.searchOrganizations({ term: args.term }));
      case "get-pipelines": return logAndReturnData("get-pipelines", pipelinesApi.getPipelines());
      case "get-pipeline": return logAndReturnData("get-pipeline", pipelinesApi.getPipeline({ id: args.pipelineId }));
      case "search-leads": return logAndReturnData("search-leads", leadsApi.searchLeads({ term: args.term }));
      case "search-all": return logAndReturnData("search-all", itemSearchApi.searchItem({ term: args.term, itemType: args.itemTypes }));
      case "get-stages":
        const pipelinesData = await logAndReturnData("get-stages:pipelines", pipelinesApi.getPipelines());
        const pipelines = pipelinesData || [];
        const allStages = [];
        for (const pipeline of pipelines) {
          try {
            const stagesResponse = await fetch(`https://api.pipedrive.com/v1/stages?pipeline_id=${pipeline.id}&api_token=${process.env.PIPEDRIVE_API_TOKEN}`);
            const stagesData = await stagesResponse.json();
            console.log(`[Pipedrive API] Raw response for get-stages for pipeline ${pipeline.id}:`, JSON.stringify(stagesData, null, 2));
            if (stagesData.success && stagesData.data) {
              allStages.push(...stagesData.data.map((stage: any) => ({ ...stage, pipeline_name: pipeline.name })));
            }
          } catch(e) {
              console.error(`[Pipedrive API] Error fetching stages for pipeline ${pipeline.id}:`, e);
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
