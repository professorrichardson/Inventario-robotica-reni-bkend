import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import dotenv from 'dotenv';
// Carregar variáveis de ambiente
dotenv.config();


console.log('🔍 INICIANDO SERVIDOR - VERIFICAÇÃO:');
console.log('📍 DATABASE_URL definida:', !!process.env.DATABASE_URL);
console.log('📍 NODE_ENV:', process.env.NODE_ENV);
console.log('📍 PORT:', process.env.PORT);
console.log('📍 FRONTEND_URL:', process.env.FRONTEND_URL);

if (!process.env.DATABASE_URL) {
  console.error('🚨 ERRO CRÍTICO: DATABASE_URL não definida!');
  console.log('💡 SOLUÇÃO: No Render, adicione a variável DATABASE_URL com:');
  console.log('   postgresql://postgres.epnkfsjetvitciwxkemv:[SENHA]@aws-1-us-east-2.pooler.supabase.com:5432/postgres');
  process.exit(1);
}




import pool, { initDatabase } from './config/database.js';
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware CORS para produção - CORRIGIDO
app.use(cors({
  origin: [
    'https://inventario-robotica-reni-frend.onrender.com',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração do multer para produção - CORRIGIDO
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // No Render, usar /tmp para arquivos temporários
    const uploadDir = '/tmp/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Nome único para evitar conflitos
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Middleware para tratar erros do multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 10MB' });
    }
  }
  next(error);
});

// Health Check - MELHORADO
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend do Inventário de Robótica está funcionando!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Rota de teste da API
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API está funcionando corretamente!',
    endpoints: [
      'GET /api/componentes',
      'POST /api/componentes',
      'PUT /api/componentes/:id',
      'DELETE /api/componentes/:id',
      'POST /api/importar-csv'
    ]
  });
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bem-vindo ao Backend do Inventário de Robótica',
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Obter todos os componentes
app.get('/api/componentes', async (req, res) => {
  try {
    console.log('📋 Buscando todos os componentes');
    const result = await pool.query(
      'SELECT * FROM componentes ORDER BY data_cadastro DESC'
    );
    
    console.log(`✅ ${result.rows.length} componentes encontrados`);
    
    res.json({
      message: 'success',
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Erro ao buscar componentes:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao buscar componentes',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Adicionar novo componente
app.post('/api/componentes', async (req, res) => {
  const { componente, quantidade } = req.body;
  
  console.log('➕ Adicionando novo componente:', { componente, quantidade });
  
  if (!componente || !quantidade) {
    return res.status(400).json({ error: 'Componente e quantidade são obrigatórios' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO componentes (componente, quantidade) VALUES ($1, $2) RETURNING *',
      [componente, parseInt(quantidade)]
    );
    
    console.log('✅ Componente adicionado com sucesso:', result.rows[0].id);
    
    res.json({
      message: 'Componente adicionado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao adicionar componente:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao adicionar componente',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Atualizar componente
app.put('/api/componentes/:id', async (req, res) => {
  const { componente, quantidade } = req.body;
  const { id } = req.params;
  
  console.log('✏️ Atualizando componente:', { id, componente, quantidade });
  
  try {
    const result = await pool.query(
      'UPDATE componentes SET componente = $1, quantidade = $2 WHERE id = $3 RETURNING *',
      [componente, parseInt(quantidade), id]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Componente não encontrado para atualização:', id);
      return res.status(404).json({ error: 'Componente não encontrado' });
    }
    
    console.log('✅ Componente atualizado com sucesso:', id);
    
    res.json({
      message: 'Componente atualizado com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar componente:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao atualizar componente',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Excluir componente
app.delete('/api/componentes/:id', async (req, res) => {
  const { id } = req.params;
  
  console.log('🗑️ Excluindo componente:', id);
  
  try {
    const result = await pool.query(
      'DELETE FROM componentes WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Componente não encontrado para exclusão:', id);
      return res.status(404).json({ error: 'Componente não encontrado' });
    }
    
    console.log('✅ Componente excluído com sucesso:', id);
    
    res.json({
      message: 'Componente excluído com sucesso',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Erro ao excluir componente:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor ao excluir componente',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Importar CSV - COMPLETAMENTE REESCRITA
app.post('/api/importar-csv', upload.single('csvFile'), async (req, res) => {
  console.log('📥 Recebendo requisição de importação CSV');
  
  if (!req.file) {
    console.log('❌ Nenhum arquivo recebido na requisição');
    return res.status(400).json({ error: 'Nenhum arquivo CSV enviado' });
  }

  console.log('📁 Arquivo recebido:', {
    nome: req.file.originalname,
    tamanho: req.file.size,
    mimetype: req.file.mimetype,
    path: req.file.path
  });
  
  const resultados = [];
  let linhasProcessadas = 0;

  try {
    // Processar CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv({
          mapHeaders: ({ header }) => header.trim(),
          skipEmptyLines: true
        }))
        .on('data', (data) => {
          linhasProcessadas++;
          
          // DEBUG: Log dos dados crus
          if (linhasProcessadas <= 3) {
            console.log(`📊 Linha ${linhasProcessadas}:`, data);
          }
          
          // Buscar por diferentes nomes de colunas (case insensitive)
          const componente = data.Componente || data.componente || data.Item || data.item || data.nome;
          const quantidade = data.Quantidade || data.quantidade || data.Qtd || data.qtd || data.quantity;
          
          if (componente && componente.toString().trim() && 
              quantidade && !isNaN(parseInt(quantidade)) && 
              parseInt(quantidade) >= 0) {
            
            resultados.push({
              componente: componente.toString().trim(),
              quantidade: parseInt(quantidade)
            });
            
            console.log(`✅ Dado válido: "${componente}" - ${quantidade}`);
          } else {
            console.log(`❌ Dado inválido na linha ${linhasProcessadas}:`, { componente, quantidade });
          }
        })
        .on('end', () => {
          console.log('✅ Processamento CSV concluído');
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ Erro no stream CSV:', error);
          reject(new Error(`Erro ao processar arquivo CSV: ${error.message}`));
        });
    });

    // Limpar arquivo temporário
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('🧹 Arquivo temporário removido');
    }

    console.log(`📈 Resumo: ${linhasProcessadas} linhas processadas, ${resultados.length} válidas`);

    if (resultados.length === 0) {
      return res.status(400).json({ 
        error: `Nenhum dado válido encontrado no CSV. 
        Processadas ${linhasProcessadas} linhas.
        Verifique se o CSV tem colunas "Componente" e "Quantidade" com dados válidos.` 
      });
    }

    // Inserir no banco usando transação
    const client = await pool.connect();
    let inseridos = 0;
    let erros = 0;
    const errors = [];
    
    try {
      console.log('💾 Iniciando inserção no banco de dados...');
      await client.query('BEGIN');
      
      for (const item of resultados) {
        try {
          await client.query(
            'INSERT INTO componentes (componente, quantidade) VALUES ($1, $2)',
            [item.componente, item.quantidade]
          );
          inseridos++;
        } catch (insertError) {
          erros++;
          errors.push(`Erro ao inserir "${item.componente}": ${insertError.message}`);
          console.error(`❌ Erro ao inserir "${item.componente}":`, insertError.message);
        }
      }
      
      await client.query('COMMIT');
      console.log(`🎉 Inserção concluída: ${inseridos} itens inseridos, ${erros} erros`);
      
      const response = {
        message: 'Importação concluída com sucesso!',
        total: resultados.length,
        inseridos: inseridos,
        erros: erros
      };
      
      if (erros > 0) {
        response.detalhes_erros = errors.slice(0, 5); // Limitar para não ficar muito grande
      }
      
      res.json(response);
      
    } catch (transactionError) {
      await client.query('ROLLBACK');
      console.error('❌ Erro na transação:', transactionError);
      throw new Error(`Erro na transação do banco: ${transactionError.message}`);
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('💥 Erro geral na importação:', error);
    
    // Limpar arquivo em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: `Erro ao processar o arquivo CSV: ${error.message}` 
    });
  }
});

// Rota para exemplo de CSV
app.get('/api/exemplo-csv', (req, res) => {
  const exemploCSV = `Componente,Quantidade
Arduino Uno,15
Sensor Ultrassônico HC-SR04,25
Motor DC 3-6V,40
LED Vermelho 5mm,100
Resistor 220Ω,200`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=exemplo_componentes.csv');
  res.send(exemploCSV);
});

// Tratamento de rotas não encontradas
app.use('*', (req, res) => {
  console.log(`❌ Rota não encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('💥 Erro não tratado:', error);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Inicializar servidor
const startServer = async () => {
  try {
    console.log('🔄 Inicializando banco de dados...');
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Banco de dados: PostgreSQL (Supabase)`);
      console.log(`🔗 Frontend: ${process.env.FRONTEND_URL}`);
      console.log(`📍 URLs:`);
      console.log(`   - Health: https://inventario-robotica-reni-bkend.onrender.com/health`);
      console.log(`   - API: https://inventario-robotica-reni-bkend.onrender.com/api`);
      console.log(`   - Frontend: https://inventario-robotica-reni-frend.onrender.com`);
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();
