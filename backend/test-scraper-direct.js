console.log('=== Starting Direct Scraper Test ===');

const puppeteer = require('puppeteer');

async function testScraper() {
    let browser;
    try {
        console.log('1. Launching browser...');
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ],
            timeout: 30000
        });
        console.log('✅ Browser launched successfully');

        console.log('2. Creating new page...');
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        console.log('✅ Page created');

        console.log('3. Navigating to SportVision shoes page...');
        await page.goto('https://www.sportvision.mk/mk/obuvki', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        console.log('✅ Page loaded');

        console.log('4. Looking for product links...');
        const productLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/product/"]'));
            return links.slice(0, 5).map(link => link.href);
        });
        console.log(`✅ Found ${productLinks.length} product links`);
        console.log('First few links:', productLinks.slice(0, 3));

        console.log('5. Testing product data extraction...');
        if (productLinks.length > 0) {
            await page.goto(productLinks[0], { 
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
            
            const productData = await page.evaluate(() => {
                const name = document.querySelector('.product-name')?.textContent?.trim();
                const price = document.querySelector('.price')?.textContent?.trim();
                return { name, price };
            });
            console.log('✅ Product data extracted:', productData);
        }

        console.log('6. Closing browser...');
        await browser.close();
        console.log('✅ Browser closed');
        console.log('=== Test completed successfully ===');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (browser) {
            await browser.close();
        }
    }
}

testScraper();
