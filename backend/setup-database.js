const mongoose = require('mongoose');
require('dotenv').config();

async function setupDatabase() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/price_runner';
    
    console.log('Connecting to MongoDB...');
    console.log('URI:', uri.replace(/\/\/.*@/, '//***:***@'));
    
    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB successfully!');
        
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('\n📊 Existing collections:', collections.map(c => c.name).join(', ') || 'none');
        
        console.log('\n✅ Database setup complete!');
        console.log('📝 Note: Collections will be created automatically when data is written.');
        console.log('🚀 You can now start your backend server.');
        
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB.');
        process.exit(0);
    } catch (error) {
        console.error('❌ MongoDB connection failed:');
        console.error('Error:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
            console.error('\n💡 Solution:');
            console.error('1. Make sure MongoDB is running');
            console.error('2. For local: Check if MongoDB service is running');
            console.error('3. For Atlas: Verify connection string and IP whitelist');
        } else if (error.message.includes('authentication failed')) {
            console.error('\n💡 Solution:');
            console.error('1. Check username and password in connection string');
            console.error('2. Verify database user exists in Atlas');
        } else {
            console.error('\n💡 Check your MONGODB_URI in .env file');
        }
        
        process.exit(1);
    }
}

setupDatabase();

