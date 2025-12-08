const { Client } = require('pg');
require('dotenv').config();

async function setupDatabase() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: 'postgres',
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

