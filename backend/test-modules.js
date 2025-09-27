console.log('Testing module loading...');

try {
    console.log('Loading Firebase service...');
    const { FirebaseService } = require('./dist/firebase.service');
    console.log('Firebase service loaded successfully');
    
    console.log('Loading SportVision scraper service...');
    const { SportVisionScraperService } = require('./dist/services/sportvision-scraper.service');
    console.log('SportVision scraper service loaded successfully');
    
    console.log('All modules loaded successfully!');
} catch (error) {
    console.error('Error loading modules:', error.message);
    console.error('Stack trace:', error.stack);
}
