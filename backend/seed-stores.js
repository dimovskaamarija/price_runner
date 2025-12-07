const { Client } = require('pg');
require('dotenv').config();

const storesData = [
    { id: 'Buzz Sneaker Station', name: 'Buzz Sneaker Station', logo_url: "https://www.supernova-novomesto.si//fileadmin/shared/logos/Buzz.jpg" },
    { id: 'D Sportska Oprema', name: 'D Sportska Oprema', logo_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjNCR1NTgfwn__qPZ7R8mArX_Gs2ydTbChZQ&s" },
    { id: 'Sport M', name: 'Sport M', logo_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQQaxbdwUQPoBxUWZrnCZGXb4EorG5axpAu9A&s" },
    { id: 'Sizeer', name: 'Sizeer', logo_url: "https://www.pepper.pl/kupony/images/256x/images/s/sizeer_logo.png" },
    { id: 'Sport Reality', name: 'Sport Reality', logo_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5Su41fRvEVaxSfB7bYyV5tj0-1ahjdrAa2AOCKqORVim2Da-VucypRksTMiFBCQoDT94&usqp=CAU" },
    {
        id: 'Sport Vision', name: 'Sport Vision', logo_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQH_-3H1v24R8x6pRjgk715UUlwTGh7iyvN5g&s"
    }];

async function seedStores() {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'price_runner',
    };
    
    const client = new Client(config);
    
    await client.connect();

    const tableCheck = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'stores'
        );
    `);

    if (!tableCheck.rows[0].exists) {
        await client.end();
        process.exit(1);
    }

    const existingResult = await client.query('SELECT id, name FROM stores');

    let inserted = 0;
    let updated = 0;

    for (const storeData of storesData) {
        const existingStore = existingResult.rows.find(row => row.id === storeData.id);
            
        if (existingStore) {
            await client.query(
                'UPDATE stores SET name = $1, logo_url = $2, "updatedAt" = NOW() WHERE id = $3',
                [storeData.name, storeData.logo_url, storeData.id]
            );
            updated++;
        } else {
            await client.query(
                'INSERT INTO stores (id, name, logo_url, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())',
                [storeData.id, storeData.name, storeData.logo_url]
            );
            inserted++;
        }
    }

    const allStoresResult = await client.query('SELECT id, name, logo_url FROM stores ORDER BY id');

    allStoresResult.rows.forEach(store => {
    });

    await client.end();
    process.exit(0);

}
seedStores();

