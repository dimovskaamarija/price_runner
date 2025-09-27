console.log('Testing Puppeteer...');

const puppeteer = require('puppeteer');

async function testPuppeteer() {
    try {
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        console.log('Browser launched successfully');
        
        const page = await browser.newPage();
        console.log('New page created');
        
        console.log('Navigating to test page...');
        await page.goto('https://www.google.com', { waitUntil: 'networkidle0' });
        console.log('Page loaded successfully');
        
        const title = await page.title();
        console.log('Page title:', title);
        
        await browser.close();
        console.log('Browser closed');
        console.log('Puppeteer test completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Puppeteer test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

testPuppeteer();
