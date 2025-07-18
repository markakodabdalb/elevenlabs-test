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

// Create Express app
const app = express();
app.use(express.json());

// Database connection
const db = new sqlite3.Database('./database.db');

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

// Define all tool names
const ToolName = {
  // Original tools
  ECHO: "echo",
  ADD: "add",
  // Student API tools
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

const PromptName = {
  SIMPLE: "simple_prompt",
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

// Add other student API functions here...
// ... (keep all your existing database functions, just convert them to return promises with MCP format)

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
      // Original tools
      {
        name: ToolName.ECHO,
        description: "Echoes back the input",
        inputSchema: zodToJsonSchema(EchoSchema),
      },
      {
        name: ToolName.ADD,
        description: "Adds two numbers",
        inputSchema: zodToJsonSchema(AddSchema),
      },
      // Student API tools
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
      // Add other student API tools here...
    ];
    return { tools };
  });

  // Tool call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        // Original tools
        case ToolName.ECHO:
          const validatedEchoArgs = EchoSchema.parse(args);
          return {
            content: [{ type: "text", text: `Echo: ${validatedEchoArgs.message}` }],
          };
        case ToolName.ADD:
          const validatedAddArgs = AddSchema.parse(args);
          const sum = validatedAddArgs.a + validatedAddArgs.b;
          return {
            content: [
              {
                type: "text",
                text: `The sum of ${validatedAddArgs.a} and ${validatedAddArgs.b} is ${sum}.`,
              },
            ],
          };
        
        // Student API tools
        case ToolName.GET_ALL_STUDENTS:
          return await getAllStudents();
        // Add other student API tool handlers here...
        
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
    return {
      prompts: [
        {
          name: PromptName.SIMPLE,
          description: "A prompt without arguments",
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    if (name === PromptName.SIMPLE) {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "This is a simple prompt without arguments.",
            },
          },
        ],
      };
    }
    throw new Error(`Unknown prompt: ${name}`);
  });

  const cleanup = async () => {
    // Cleanup logic if needed
  };

  return { server, cleanup };
};

// Keep the original REST API endpoints
// ======================
// ÖĞRENCİLER API ENDPOINTS
// ======================

// Tüm öğrencileri getir
app.get('/api/ogrenciler', (req, res) => {
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
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// ID'ye göre öğrenci getir
app.get('/api/ogrenciler/:id', (req, res) => {
  const query = `
    SELECT 
      o.*, 
      s.sinif_adi,
      s.seviye
    FROM ogrenciler o
    LEFT JOIN siniflar s ON o.sinif_id = s.id
    WHERE o.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Öğrenci bulunamadı' });
      return;
    }
    res.json({ data: row });
  });
});

// Öğrenci notlarını getir
app.get('/api/ogrenciler/:id/notlar', (req, res) => {
  const query = `
    SELECT 
      n.*, 
      d.ders_adi,
      d.kod as ders_kodu
    FROM notlar n
    JOIN dersler d ON n.ders_id = d.id
    WHERE n.ogrenci_id = ?
    ORDER BY n.tarih DESC
  `;
  
  db.all(query, [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// Öğrenci devamsızlıklarını getir
app.get('/api/ogrenciler/:id/devamsizlik', (req, res) => {
  const query = `
    SELECT 
      d.*, 
      dr.ders_adi,
      dr.kod as ders_kodu
    FROM devamsizlik d
    JOIN dersler dr ON d.ders_id = dr.id
    WHERE d.ogrenci_id = ?
    ORDER BY d.tarih DESC
  `;
  
  db.all(query, [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// Öğrenci ödemelerini getir
app.get('/api/ogrenciler/:id/odemeler', (req, res) => {
  const query = `
    SELECT *
    FROM odemeler
    WHERE ogrenci_id = ?
    ORDER BY tarih DESC
  `;
  
  db.all(query, [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// Sınıfa göre öğrenciler
app.get('/api/siniflar/:sinifId/ogrenciler', (req, res) => {
  const query = `
    SELECT 
      o.*, 
      s.sinif_adi,
      s.seviye
    FROM ogrenciler o
    JOIN siniflar s ON o.sinif_id = s.id
    WHERE o.sinif_id = ? AND o.aktif = 1
    ORDER BY o.ad, o.soyad
  `;
  
  db.all(query, [req.params.sinifId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// Öğrenci ara (isim, soyisim, TC)
app.get('/api/ogrenciler/ara/:search', (req, res) => {
  const searchTerm = `%${req.params.search}%`;
  const query = `
    SELECT 
      o.*, 
      s.sinif_adi,
      s.seviye
    FROM ogrenciler o
    LEFT JOIN siniflar s ON o.sinif_id = s.id
    WHERE (o.ad LIKE ? OR o.soyad LIKE ? OR o.tc_no LIKE ?)
    AND o.aktif = 1
    ORDER BY o.ad, o.soyad
  `;
  
  db.all(query, [searchTerm, searchTerm, searchTerm], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

// Öğrenci not ortalaması
app.get('/api/ogrenciler/:id/ortalama', (req, res) => {
  const query = `
    SELECT 
      AVG(CAST(not_degeri as FLOAT)) as genel_ortalama,
      COUNT(*) as toplam_not,
      d.ders_adi,
      AVG(CAST(n.not_degeri as FLOAT)) as ders_ortalama
    FROM notlar n
    JOIN dersler d ON n.ders_id = d.id
    WHERE n.ogrenci_id = ?
    GROUP BY d.id, d.ders_adi
    ORDER BY ders_ortalama DESC
  `;
  
  db.all(query, [req.params.id], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    // Genel ortalama hesapla
    const genelOrtalama = rows.length > 0 ? 
      rows.reduce((sum, row) => sum + row.ders_ortalama, 0) / rows.length : 0;
    
    res.json({ 
      data: {
        genel_ortalama: genel_ortalama.toFixed(2),
        ders_ortalamalari: rows
      }
    });
  });
});

// Yeni öğrenci ekle
app.post('/api/ogrenciler', (req, res) => {
  const { tc_no, ad, soyad, dogum_tarihi, cinsiyet, telefon, email, adres, veli_adi, veli_telefonu, sinif_id } = req.body;
  
  const query = `
    INSERT INTO ogrenciler (tc_no, ad, soyad, dogum_tarihi, cinsiyet, telefon, email, adres, veli_adi, veli_telefonu, sinif_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(query, [tc_no, ad, soyad, dogum_tarihi, cinsiyet, telefon, email, adres, veli_adi, veli_telefonu, sinif_id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Öğrenci başarıyla eklendi', id: this.lastID });
  });
});

// Öğrenci güncelle
app.put('/api/ogrenciler/:id', (req, res) => {
  const { tc_no, ad, soyad, dogum_tarihi, cinsiyet, telefon, email, adres, veli_adi, veli_telefonu, sinif_id, aktif } = req.body;
  
  const query = `
    UPDATE ogrenciler 
    SET tc_no = ?, ad = ?, soyad = ?, dogum_tarihi = ?, cinsiyet = ?, 
        telefon = ?, email = ?, adres = ?, veli_adi = ?, veli_telefonu = ?, 
        sinif_id = ?, aktif = ?
    WHERE id = ?
  `;
  
  db.run(query, [tc_no, ad, soyad, dogum_tarihi, cinsiyet, telefon, email, adres, veli_adi, veli_telefonu, sinif_id, aktif, req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Öğrenci başarıyla güncellendi', changes: this.changes });
  });
});

// Öğrenci sil (soft delete)
app.delete('/api/ogrenciler/:id', (req, res) => {
  const query = `UPDATE ogrenciler SET aktif = 0 WHERE id = ?`;
  
  db.run(query, [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Öğrenci başarıyla silindi', changes: this.changes });
  });
});

// Özel sorgu endpoint'i (Claude için)
app.post('/api/custom-query', (req, res) => {
  const { query, params = [] } = req.body;
  
  // Güvenlik kontrolü - sadece SELECT sorgularına izin ver
  if (!query.trim().toUpperCase().startsWith('SELECT')) {
    res.status(400).json({ error: 'Sadece SELECT sorguları desteklenir' });
    return;
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ data: rows });
  });
});

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
  console.log(`📝 REST API endpoints available at /api/*`);
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