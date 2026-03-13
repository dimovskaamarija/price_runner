const { Client } = require('pg');
require('dotenv').config();

async function setupDatabase() {
    cconst config = {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
};
    
    const client = new Client(config);
    
    try {
        await client.connect();
        const dbName = process.env.DB_DATABASE || 'price_runner';
        
        const dbCheck = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [dbName]
        );
        
        if (dbCheck.rows.length === 0) {
        }
        await client.end();
        config.database = dbName;
        
        const dbClient = new Client(config);
        await dbClient.connect();
        
        const tablesCheck = await dbClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('products', 'price_history')
        `);
        
        const existingTables = tablesCheck.rows.map(row => row.table_name);
        
        await dbClient.end();
        
        process.exit(0);
    } catch (error) {
        console.error('PostgreSQL connection failed:');
        process.exit(1);
    }
}

setupDatabase();

