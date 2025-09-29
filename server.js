import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pool, { initDatabase } from './config/database.js';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// Configuração do multer para upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Aceitar apenas arquivos CSV
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'), false);
    }
  },
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024 // 10MB padrão
  }
});

// Middleware para tratar erros do multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande' });
    }
  }
  next(error);
});

// Inicializar banco de dados
initDatabase().catch(console.error);

// Rotas da API

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: 'PostgreSQL', 
    timestamp: new Date().toISOString() 
  });
});

// Obter todos os componentes
app.get('/api/componentes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM componentes ORDER BY data_cadastro DESC'
    );
    res.json({
      message: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('Erro ao buscar componentes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Adicionar novo componente
app.post('/api/componentes', async (req, res) => {
  const { componente, quantidade } = req.body;
  
  if (!componente || !quantidade) {
    return res.status(400).json({ error: 'Componente e quantidade são obrigatórios' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO componentes (componente, quantidade) VALUES ($1, $2) RETURNING *',
      [componente, quantidade]
    );
    
    res.json({
      message: 'Componente adicionado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao adicionar componente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar componente
app.put('/api/componentes/:id', async (req, res) => {
  const { componente, quantidade } = req.body;
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'UPDATE componentes SET componente = $1, quantidade = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [componente, quantidade, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Componente não encontrado' });
    }
    
    res.json({
      message: 'Componente atualizado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar componente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Excluir componente
app.delete('/api/componentes/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      'DELETE FROM componentes WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Componente não encontrado' });
    }
    
    res.json({
      message: 'Componente excluído com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erro ao excluir componente:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Importar CSV
app.post('/api/importar-csv', upload.single('csvFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  console.log('Arquivo recebido:', req.file.originalname);
  
  const resultados = [];
  let linhasProcessadas = 0;

  try {
    // Processar CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase(),
          skipEmptyLines: true
        }))
        .on('data', (data) => {
          linhasProcessadas++;
          
          // Buscar por diferentes nomes de colunas
          const componente = data.componente || data.item || data.nome;
          const quantidade = data.quantidade || data.qtd || data.quantity;
          
          if (componente && !isNaN(parseInt(quantidade))) {
            resultados.push({
              componente: componente.toString().trim(),
              quantidade: parseInt(quantidade)
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Limpar arquivo temporário
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.log(`Processadas ${linhasProcessadas} linhas, ${resultados.length} válidas`);

    if (resultados.length === 0) {
      return res.status(400).json({ 
        error: 'Nenhum dado válido encontrado no CSV' 
      });
    }

    // Inserir no banco usando transação
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const item of resultados) {
        await client.query(
          'INSERT INTO componentes (componente, quantidade) VALUES ($1, $2)',
          [item.componente, item.quantidade]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({
        message: 'Importação concluída com sucesso!',
        total: resultados.length,
        inseridos: resultados.length,
        erros: 0
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Erro ao importar CSV:', error);
    
    // Limpar arquivo em caso de erro
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Erro ao processar o arquivo CSV' });
  }
});

// Rota para exemplo de CSV
app.get('/api/exemplo-csv', (req, res) => {
  const exemploCSV = `componente,quantidade
Arduino Uno,15
Sensor Ultrassônico HC-SR04,25
Motor DC 3-6V,40
LED Vermelho 5mm,100`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=exemplo_componentes.csv');
  res.send(exemploCSV);
});

// Tratamento de rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Banco de dados: PostgreSQL (Supabase)`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
});