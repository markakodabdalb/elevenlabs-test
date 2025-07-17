#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

const server = new Server(
  {
    name: 'students-api',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Mevcut araçları listele
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_all_students',
        description: 'Tüm aktif öğrencileri sınıf bilgileriyle birlikte getir',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_student_by_id',
        description: 'ID ile öğrenci bilgilerini getir',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Öğrenci ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_student_grades',
        description: 'Öğrencinin notlarını getir',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Öğrenci ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_student_attendance',
        description: 'Öğrencinin devamsızlık bilgilerini getir',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Öğrenci ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_student_payments',
        description: 'Öğrencinin ödeme bilgilerini getir',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Öğrenci ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'get_students_by_class',
        description: 'Sınıfa göre öğrencileri getir',
        inputSchema: {
          type: 'object',
          properties: {
            sinif_id: {
              type: 'integer',
              description: 'Sınıf ID',
            },
          },
          required: ['sinif_id'],
        },
      },
      {
        name: 'search_students',
        description: 'Öğrenci ara (isim, soyisim, TC)',
        inputSchema: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'Arama terimi',
            },
          },
          required: ['search'],
        },
      },
      {
        name: 'get_student_average',
        description: 'Öğrencinin not ortalamasını getir',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Öğrenci ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'add_student',
        description: 'Yeni öğrenci ekle',
        inputSchema: {
          type: 'object',
          properties: {
            tc_no: { type: 'string', description: 'TC Kimlik No' },
            ad: { type: 'string', description: 'Ad' },
            soyad: { type: 'string', description: 'Soyad' },
            dogum_tarihi: { type: 'string', description: 'Doğum Tarihi (YYYY-MM-DD)' },
            cinsiyet: { type: 'string', description: 'Cinsiyet (E/K)' },
            telefon: { type: 'string', description: 'Telefon' },
            email: { type: 'string', description: 'Email' },
            adres: { type: 'string', description: 'Adres' },
            veli_adi: { type: 'string', description: 'Veli Adı' },
            veli_telefonu: { type: 'string', description: 'Veli Telefonu' },
            sinif_id: { type: 'integer', description: 'Sınıf ID' },
          },
          required: ['tc_no', 'ad', 'soyad', 'dogum_tarihi', 'cinsiyet'],
        },
      },
      {
        name: 'update_student',
        description: 'Öğrenci bilgilerini güncelle',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'integer', description: 'Öğrenci ID' },
            tc_no: { type: 'string', description: 'TC Kimlik No' },
            ad: { type: 'string', description: 'Ad' },
            soyad: { type: 'string', description: 'Soyad' },
            dogum_tarihi: { type: 'string', description: 'Doğum Tarihi (YYYY-MM-DD)' },
            cinsiyet: { type: 'string', description: 'Cinsiyet (E/K)' },
            telefon: { type: 'string', description: 'Telefon' },
            email: { type: 'string', description: 'Email' },
            adres: { type: 'string', description: 'Adres' },
            veli_adi: { type: 'string', description: 'Veli Adı' },
            veli_telefonu: { type: 'string', description: 'Veli Telefonu' },
            sinif_id: { type: 'integer', description: 'Sınıf ID' },
            aktif: { type: 'boolean', description: 'Aktif durumu' },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_student',
        description: 'Öğrenci sil (soft delete)',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Öğrenci ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'custom_query',
        description: 'Özel SELECT sorgusu çalıştır',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL SELECT sorgusu',
            },
            params: {
              type: 'array',
              description: 'Sorgu parametreleri',
              items: {
                type: 'string',
              },
            },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// Araç çağrılarını işle
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_all_students':
        const allStudents = await axios.get(`${API_BASE_URL}/ogrenciler`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(allStudents.data, null, 2),
            },
          ],
        };

      case 'get_student_by_id':
        const student = await axios.get(`${API_BASE_URL}/ogrenciler/${args.id}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(student.data, null, 2),
            },
          ],
        };

      case 'get_student_grades':
        const grades = await axios.get(`${API_BASE_URL}/ogrenciler/${args.id}/notlar`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(grades.data, null, 2),
            },
          ],
        };

      case 'get_student_attendance':
        const attendance = await axios.get(`${API_BASE_URL}/ogrenciler/${args.id}/devamsizlik`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(attendance.data, null, 2),
            },
          ],
        };

      case 'get_student_payments':
        const payments = await axios.get(`${API_BASE_URL}/ogrenciler/${args.id}/odemeler`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payments.data, null, 2),
            },
          ],
        };

      case 'get_students_by_class':
        const classStudents = await axios.get(`${API_BASE_URL}/siniflar/${args.sinif_id}/ogrenciler`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(classStudents.data, null, 2),
            },
          ],
        };

      case 'search_students':
        const searchResults = await axios.get(`${API_BASE_URL}/ogrenciler/ara/${args.search}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(searchResults.data, null, 2),
            },
          ],
        };

      case 'get_student_average':
        const average = await axios.get(`${API_BASE_URL}/ogrenciler/${args.id}/ortalama`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(average.data, null, 2),
            },
          ],
        };

      case 'add_student':
        const newStudent = await axios.post(`${API_BASE_URL}/ogrenciler`, args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(newStudent.data, null, 2),
            },
          ],
        };

      case 'update_student':
        const updatedStudent = await axios.put(`${API_BASE_URL}/ogrenciler/${args.id}`, args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(updatedStudent.data, null, 2),
            },
          ],
        };

      case 'delete_student':
        const deletedStudent = await axios.delete(`${API_BASE_URL}/ogrenciler/${args.id}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(deletedStudent.data, null, 2),
            },
          ],
        };

      case 'custom_query':
        const customResult = await axios.post(`${API_BASE_URL}/custom-query`, {
          query: args.query,
          params: args.params || [],
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(customResult.data, null, 2),
            },
          ],
        };

      default:
        throw new Error(`Bilinmeyen araç: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Hata: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Sunucuyu başlat
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Students API MCP server running on stdio');
}

runServer().catch(console.error);