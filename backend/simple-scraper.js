console.log('Starting simple scraper test...');

const puppeteer = require('puppeteer');

async function simpleScraper() {
    let browser;
    try {
        console.log('Launching browser with minimal config...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
            timeout: 30000
        });
        console.log('Browser launched successfully');
        
        const page = await browser.newPage();
        console.log('New page created');
        
        // Set a reasonable timeout
        page.setDefaultTimeout(30000);
        
        console.log('Navigating to SportVision...');
        await page.goto('https://www.sportvision.mk', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        console.log('Page loaded successfully');
        
        const title = await page.title();
        console.log('Page title:', title);
        
        // Try to find some products
        const productLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/product/"]'));
            return links.slice(0, 5).map(link => link.href);
        });
        
        console.log('Found product links:', productLinks.length);
        console.log('First few links:', productLinks.slice(0, 3));
        
        await browser.close();
        console.log('Browser closed');
        console.log('Simple scraper test completed successfully!');
        
    } catch (error) {
        console.error('Simple scraper test failed:', error.message);
        console.error('Stack trace:', error.stack);
        if (browser) {
            await browser.close();
        }
    }
}

// Set a timeout for the entire process
setTimeout(() => {
    console.log('Process timeout reached, exiting...');
    process.exit(1);
}, 2 * 60 * 1000); // 2 minutes timeout

simpleScraper();
