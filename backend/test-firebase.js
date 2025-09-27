console.log('Testing Firebase connection...');

try {
    const { FirebaseService } = require('./dist/firebase.service');
    console.log('Firebase service loaded');
    
    const firebaseService = new FirebaseService();
    console.log('Firebase service instantiated');
    
    const db = firebaseService.getDb();
    console.log('Firebase database reference obtained');
    
    console.log('Firebase connection test completed successfully!');
    process.exit(0);
} catch (error) {
    console.error('Firebase connection test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}
