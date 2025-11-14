const { Client } = require('pg');
require('dotenv').config();

async function setupDatabase() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: 'postgres', // Connect to default database first
    };

    console.log('Connecting to PostgreSQL...');
    console.log(`Host: ${config.host}:${config.port}`);
    console.log(`User: ${config.user}`);
    
    const client = new Client(config);
    
    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL successfully!');
        
        const dbName = process.env.DB_DATABASE || 'price_runner';
        
        // Check if database exists
        const dbCheck = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [dbName]
        );
        
        if (dbCheck.rows.length === 0) {
            console.log(`\n📦 Creating database: ${dbName}...`);
            await client.query(`CREATE DATABASE ${dbName}`);
            console.log(`✅ Database "${dbName}" created successfully!`);
        } else {
            console.log(`\n✅ Database "${dbName}" already exists.`);
        }
        
        // Switch to the database
        await client.end();
        config.database = dbName;
        
        const dbClient = new Client(config);
        await dbClient.connect();
        
        // Check if tables exist
        const tablesCheck = await dbClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('products', 'price_history')
        `);
        
        const existingTables = tablesCheck.rows.map(row => row.table_name);
        
        if (existingTables.length === 0) {
            console.log('\n📋 Note: Tables will be created automatically by TypeORM.');
            console.log('   Start your backend server to create tables.');
        } else {
            console.log('\n📊 Existing tables:', existingTables.join(', '));
        }
        
        await dbClient.end();
        
        console.log('\n✅ PostgreSQL setup complete!');
        console.log('🚀 You can now start your backend server.');
        console.log('\n📝 Tables will be created automatically when you start the server.');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ PostgreSQL connection failed:');
        console.error('Error:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Solution:');
            console.error('1. Make sure PostgreSQL is running');
            console.error('2. Check connection settings in .env file');
            console.error('3. Verify PostgreSQL is installed and service is running');
        } else if (error.code === '28P01') {
            console.error('\n💡 Solution:');
            console.error('1. Check username and password in .env file');
            console.error('2. Verify PostgreSQL user exists and has permissions');
        } else {
            console.error('\n💡 Check your database configuration in .env file');
        }
        
        process.exit(1);
    }
}

setupDatabase();

