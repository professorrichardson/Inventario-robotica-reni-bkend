import pool from './config/database.js';

async function testConnection() {
  try {
    console.log('🧪 Testando conexão com o Supabase...');
    
    const client = await pool.connect();
    console.log('✅ Conexão estabelecida com sucesso!');
    
    // Testar consulta simples
    const result = await client.query('SELECT version()');
    console.log('📊 Versão do PostgreSQL:', result.rows[0].version);
    
    // Testar nossa tabela
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'componentes'
      );
    `);
    
    console.log('📋 Tabela "componentes" existe:', tableCheck.rows[0].exists);
    
    client.release();
    console.log('🎉 Teste de conexão concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste de conexão:', error.message);
  } finally {
    process.exit();
  }
}

testConnection();