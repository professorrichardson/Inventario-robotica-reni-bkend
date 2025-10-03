import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Usar DATABASE_URL obrigatoriamente
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL não definida!');
  console.error('💡 Configure DATABASE_URL no Render com a string completa de conexão');
  process.exit(1);
}

// Log seguro (sem mostrar senha)
const safeLogString = connectionString.replace(/:[^:@]+@/, ':***@');
console.log('🔗 String de conexão:', safeLogString);

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

// Função para inicializar banco
export const initDatabase = async () => {
  let client;
  
  try {
    console.log('🔄 Conectando ao banco de dados...');
    
    client = await pool.connect();
    console.log('✅ Conexão com PostgreSQL estabelecida!');
    
    // Testar versão
    const versionResult = await client.query('SELECT version()');
    console.log('🗄️ PostgreSQL conectado com sucesso');
    
    // Criar tabela se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS componentes (
        id SERIAL PRIMARY KEY,
        componente VARCHAR(255) NOT NULL,
        quantidade INTEGER NOT NULL,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela "componentes" verificada/criada');
    
  } catch (error) {
    console.error('❌ ERRO DE CONEXÃO:', error.message);
    console.log('🔧 Possíveis causas:');
    console.log('   - Senha incorreta no DATABASE_URL');
    console.log('   - Host/usuário incorretos');
    console.log('   - Supabase não está aceitando conexões');
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

export default pool;
