import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Configuração do pool de conexões PostgreSQL para Supabase
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10, // número máximo de clientes no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Testar conexão
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL no Supabase');
});

pool.on('error', (err) => {
  console.error('❌ Erro na conexão com PostgreSQL:', err);
});

// Função para criar a tabela se não existir
export const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    // Criar tabela de componentes
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS componentes (
        id SERIAL PRIMARY KEY,
        componente VARCHAR(255) NOT NULL,
        quantidade INTEGER NOT NULL,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await client.query(createTableQuery);
    
    console.log('✅ Tabela "componentes" verificada/criada com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Exportar o pool para uso em outras partes da aplicação
export default pool;