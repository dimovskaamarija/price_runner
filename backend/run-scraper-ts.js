console.log('=== Starting TypeScript Scraper ===');

// Register TypeScript
require('ts-node/register');

try {
    console.log('Loading TypeScript modules...');
    
    // Import the services directly
    const { SportVisionScraperService } = require('./src/services/sportvision-scraper.service');
    const { FirebaseService } = require('./src/firebase.service');
    const { ProductService } = require('./src/services/product.service');
    
    console.log('Modules loaded successfully');
    
    async function runScraper() {
        try {
            console.log('Initializing Firebase service...');
            const firebaseService = new FirebaseService();
            console.log('Firebase service initialized');
            
            console.log('Initializing product service...');
            const productService = new ProductService(firebaseService);
            console.log('Product service initialized');
            
            console.log('Initializing scraper service...');
            const scraperService = new SportVisionScraperService(firebaseService, productService);
            console.log('Scraper service initialized');
            
            console.log('Starting product scraping...');
            await scraperService.scrapeProducts();
            console.log('Scraping completed successfully!');
            process.exit(0);
        } catch (error) {
            console.error('Scraping failed:', error);
            console.error('Error details:', error.message);
            console.error('Stack trace:', error.stack);
            process.exit(1);
        }
    }
    
    runScraper();
    
} catch (error) {
    console.error('Failed to load modules:', error.message);
    process.exit(1);
}
