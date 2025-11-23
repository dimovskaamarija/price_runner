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
        
        console.log('Starting product scraping with timeout...');
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Scraping timeout after 5 minutes')), 5 * 60 * 1000);
        });
        
        const scrapingPromise = scraperService.scrapeProducts();
        
        await Promise.race([scrapingPromise, timeoutPromise]);
        console.log('Scraping completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Scraping failed:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

setTimeout(() => {
    console.log('Process timeout reached, exiting...');
    process.exit(1);
}, 10 * 60 * 1000);

runScraper();
