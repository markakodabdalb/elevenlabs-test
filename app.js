import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';

const app = express();
app.use(express.json());

// Database bağlantısı
const db = new sqlite3.Database('./database.db');

// CORS ayarları
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

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

// Server başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database bağlantısı kapatıldı');
    process.exit(0);
  });
}); 