console.log('=== Debugging Product Page Structure ===');

const puppeteer = require('puppeteer');

async function debugProductPage() {
    let browser;
    try {
        console.log('1. Launching browser...');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        page.setDefaultTimeout(30000);

        console.log('2. Navigating to SportVision shoes page...');
        await page.goto('https://www.sportvision.mk/mk/obuvki', { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        console.log('3. Getting first product link...');
        const productLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('.product-item a, .item a'));
            return links.slice(0, 1).map(link => link.href);
        });

        if (productLinks.length === 0) {
            console.log('❌ No product links found');
            return;
        }

        console.log(`4. Navigating to product: ${productLinks[0]}`);
        await page.goto(productLinks[0], { 
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        console.log('5. Analyzing product page structure...');
        
        // Check current selectors
        const currentSelectors = await page.evaluate(() => {
            const selectors = {
                name: '.product-name',
                price: '.price',
                image: '.gallery-placeholder__image',
                brand: '.product-brand',
                description: '.product-description',
                color: '.color, [data-th="Color"]',
                sizes: '.swatch-option.text',
                breadcrumbs: '.breadcrumbs'
            };
            
            const results = {};
            Object.entries(selectors).forEach(([key, selector]) => {
                const elements = document.querySelectorAll(selector);
                results[key] = {
                    count: elements.length,
                    text: elements.length > 0 ? elements[0].textContent?.trim().substring(0, 50) : null
                };
            });
            return results;
        });

        console.log('\nCurrent selector results:');
        Object.entries(currentSelectors).forEach(([key, result]) => {
            console.log(`${key}: ${result.count} matches - "${result.text}"`);
        });

        // Look for alternative selectors
        const alternativeSelectors = await page.evaluate(() => {
            const patterns = [
                'h1', 'h2', 'h3', // for name
                '[class*="price"]', '[class*="cost"]', '[class*="amount"]', // for price
                'img', // for images
                '[class*="brand"]', '[class*="manufacturer"]', // for brand
                '[class*="description"]', '[class*="detail"]', // for description
                '[class*="breadcrumb"]', 'nav' // for breadcrumbs
            ];
            
            const results = {};
            patterns.forEach(pattern => {
                const elements = document.querySelectorAll(pattern);
                results[pattern] = {
                    count: elements.length,
                    text: elements.length > 0 ? elements[0].textContent?.trim().substring(0, 50) : null
                };
            });
            return results;
        });

        console.log('\nAlternative selector results:');
        Object.entries(alternativeSelectors).forEach(([key, result]) => {
            if (result.count > 0) {
                console.log(`${key}: ${result.count} matches - "${result.text}"`);
            }
        });

        await browser.close();
        console.log('\n✅ Product page debug completed');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        if (browser) {
            await browser.close();
        }
    }
}

debugProductPage();
