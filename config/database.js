import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// VERIFICAÇÃO RÍGIDA
if (!process.env.DATABASE_URL) {
  console.error('❌ ERRO: DATABASE_URL não definida!');
  process.exit(1);
}

console.log('🔗 Configurando pool de conexão...');

// Criar UM ÚNICO pool global
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Configurações otimizadas para Render
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  // Prevenir vazamentos de conexão
  allowExitOnIdle: true
});

// Log de eventos do pool
pool.on('connect', () => {
  console.log('✅ Nova conexão estabelecida com o banco');
});

pool.on('error', (err) => {
  console.error('❌ Erro no pool:', err);
});

pool.on('acquire', () => {
  console.log('🔗 Cliente adquirido do pool');
});

pool.on('remove', () => {
  console.log('🗑️ Cliente removido do pool');
});

// Função para inicializar banco
export const initDatabase = async () => {
  let client;
  
  try {
    console.log('🔄 Inicializando banco de dados...');
    
    client = await pool.connect();
    console.log('✅ Cliente conectado para inicialização');
    
    // Testar conexão
    const result = await client.query('SELECT NOW() as current_time');
    console.log('⏰ Hora do banco:', result.rows[0].current_time);
    
    // Criar tabela
    await client.query(`
      CREATE TABLE IF NOT EXISTS componentes (
        id SERIAL PRIMARY KEY,
        componente VARCHAR(255) NOT NULL,
        quantidade INTEGER NOT NULL,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela componentes verificada');
    
  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
      console.log('🔓 Cliente liberado');
    }
  }
};

// Exportar o MESMO pool para toda a aplicação
export default pool;
