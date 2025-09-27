const { SportVisionScraperService } = require('./dist/services/sportvision-scraper.service');
const { FirebaseService } = require('./dist/firebase.service');

async function runScraper() {
    try {
        console.log('Starting SportVision scraper...');
        console.log('Initializing Firebase service...');
        const firebaseService = new FirebaseService();
        console.log('Firebase service initialized');
        
        console.log('Initializing scraper service...');
        const scraperService = new SportVisionScraperService(firebaseService);
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
