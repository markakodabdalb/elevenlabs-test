mcp-server.js must olması gereken. bu dosyayı claude ın config dosyasında node ile ayağa kaldırmak gerekiyor. 

ayrıca localhost:3000/api nin ayakta olması lazım. 
node app.js yaptıktan sonra claude yi çalıştırıyoruz. 

{
    "mcpServers": {
      "sqlite": {
        "command": "npx",
        "args": ["-y", "mcp-server-sqlite-npx", "/Users/markakod/Documents/genai/mcp-claude/database.db"]
      },
      "students-api": {
        "command": "node",
        "args": ["/Users/markakod/Documents/genai/mcp-claude/mcp-server.js"],
        "env": {
          "API_BASE_URL": "http://localhost:3000/api"
        }
      }
    }
  }

