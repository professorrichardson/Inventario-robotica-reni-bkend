import pkg from 'pg';
const { Pool } = pkg;

// Usar DATABASE_URL se disponível, senão usar variáveis separadas
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

console.log('🔗 String de conexão:', connectionString.replace(/:[^:@]+@/, ':***@'));

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false,
    servername: process.env.DB_HOST || 'aws-1-us-east-2.pooler.supabase.com'
  },
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
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
