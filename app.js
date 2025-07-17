import express from 'express';
import sqlite3 from 'sqlite3';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Optional: instructions.md (if exists)
let instructions = "";
try {
  instructions = readFileSync(join(__dirname, "instructions.md"), "utf-8");
} catch {}

// Database connection
const db = new sqlite3.Database('./database.db');

// Create Express app
const app = express();
app.use(express.json());

// CORS settings
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Student API Schemas
const StudentSchema = z.object({
  tc_no: z.string().describe("TC Kimlik No"),
  ad: z.string().describe("Ad"),
  soyad: z.string().describe("Soyad"),
  dogum_tarihi: z.string().describe("Doğum Tarihi (YYYY-MM-DD)"),
  cinsiyet: z.string().describe("Cinsiyet (E/K)"),
  telefon: z.string().optional().describe("Telefon"),
  email: z.string().optional().describe("Email"),
  adres: z.string().optional().describe("Adres"),
  veli_adi: z.string().optional().describe("Veli Adı"),
  veli_telefonu: z.string().optional().describe("Veli Telefonu"),
  sinif_id: z.number().optional().describe("Sınıf ID"),
});

const ToolName = {
  GET_ALL_STUDENTS: "get_all_students",
  GET_STUDENT_BY_ID: "get_student_by_id",
  GET_STUDENT_GRADES: "get_student_grades",
  GET_STUDENT_ATTENDANCE: "get_student_attendance",
  GET_STUDENT_PAYMENTS: "get_student_payments",
  GET_STUDENTS_BY_CLASS: "get_students_by_class",
  SEARCH_STUDENTS: "search_students",
  GET_STUDENT_AVERAGE: "get_student_average",
  ADD_STUDENT: "add_student",
  UPDATE_STUDENT: "update_student",
  DELETE_STUDENT: "delete_student",
  CUSTOM_QUERY: "custom_query"
};

const createMCPServer = () => {
  const server = new Server(
    {
      name: "student-api-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: {},
        resources: { subscribe: true },
        tools: {},
        logging: {},
        completions: {},
      },
      instructions,
    }
  );

  // Tool list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = [
      {
        name: ToolName.GET_ALL_STUDENTS,
        description: "Tüm aktif öğrencileri sınıf bilgileriyle birlikte getir",
        inputSchema: {},
      },
      {
        name: ToolName.GET_STUDENT_BY_ID,
        description: "ID ile öğrenci bilgilerini getir",
        inputSchema: zodToJsonSchema(z.object({
          id: z.number().describe("Öğrenci ID")
        })),
      },
      // ... Add other tools similarly
    ];
    return { tools };
  });

  // Tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case ToolName.GET_ALL_STUDENTS:
          return await getAllStudents();
        case ToolName.GET_STUDENT_BY_ID:
          return await getStudentById(args.id);
        // ... Add other tool handlers
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  // Prompt handlers
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: [] };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    throw new Error(`Unknown prompt: ${request.params.name}`);
  });

  const cleanup = async () => {
    // Cleanup logic if needed
  };

  return { server, cleanup };
};

// Student API Functions
async function getAllStudents() {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        o.*,
        s.sinif_adi,
        s.seviye
      FROM ogrenciler o
      LEFT JOIN siniflar s ON o.sinif_id = s.id
      WHERE o.aktif = 1
      ORDER BY o.ad, o.soyad
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          content: [{ type: "text", text: JSON.stringify({ data: rows }, null, 2) }],
        });
      }
    });
  });
}

async function getStudentById(id) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        o.*, 
        s.sinif_adi,
        s.seviye
      FROM ogrenciler o
      LEFT JOIN siniflar s ON o.sinif_id = s.id
      WHERE o.id = ?
    `;
    
    db.get(query, [id], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        reject(new Error('Öğrenci bulunamadı'));
      } else {
        resolve({
          content: [{ type: "text", text: JSON.stringify({ data: row }, null, 2) }],
        });
      }
    });
  });
}

// ... Add other student API functions similarly

// SSE Transport Setup
const transports = new Map();

app.get("/sse", async (req, res) => {
  let transport;
  const { server, cleanup } = createMCPServer();

  if (req?.query?.sessionId) {
    const sessionId = req?.query?.sessionId;
    transport = transports.get(sessionId);
    console.error("Client Reconnecting? This shouldn't happen", transport?.sessionId);
  } else {
    transport = new SSEServerTransport("/message", res);
    transports.set(transport.sessionId, transport);
    await server.connect(transport);
    console.error("Client Connected: ", transport.sessionId);

    server.onclose = async () => {
      console.error("Client Disconnected: ", transport.sessionId);
      transports.delete(transport.sessionId);
      await cleanup();
    };
  }
});

app.post("/message", async (req, res) => {
  const sessionId = req?.query?.sessionId;
  const transport = transports.get(sessionId);
  if (transport) {
    console.error("Client Message from", sessionId);
    await transport.handlePostMessage(req, res);
  } else {
    console.error(`No transport found for sessionId ${sessionId}`);
    res.status(404).json({ error: "Session not found" });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', name: 'student-api-mcp' });
});

// Claude MCP compatibility endpoints
app.post('/register', (req, res) => {
  res.json({ result: 'ok' });
});

app.get('/.well-known/oauth-authorization-server', (req, res) => {
  res.json({});
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Student API MCP Server started");
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 SSE endpoint: /sse`);
  console.log(`📮 Message endpoint: /message`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed');
    process.exit(0);
  });
}); 