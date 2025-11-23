console.log('=== Debugging Product Data Extraction ===');

const puppeteer = require('puppeteer');

async function debugProductData() {
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

        console.log('5. Testing current selectors...');
        const currentData = await page.evaluate(() => {
            const name = document.querySelector('.product-name')?.textContent?.trim();
            const price = parseFloat(document.querySelector('.price')?.textContent?.replace(/[^0-9.]/g, '') || '0');
            const imageUrl = document.querySelector('.gallery-placeholder__image')?.getAttribute('src') || '';
            const brand = document.querySelector('.product-brand')?.textContent?.trim();
            const description = document.querySelector('.product-description')?.textContent?.trim();
            
            return { name, price, imageUrl, brand, description };
        });

        console.log('Current selector results:');
        console.log('Name:', currentData.name);
        console.log('Price:', currentData.price);
        console.log('Image URL:', currentData.imageUrl);
        console.log('Brand:', currentData.brand);
        console.log('Description:', currentData.description);

        console.log('\n6. Looking for alternative selectors...');
        const alternativeData = await page.evaluate(() => {
            const selectors = {
                name: ['h1', 'h2', '.product-title', '.product-name', '[class*="title"]', '[class*="name"]'],
                price: ['.price', '[class*="price"]', '[class*="cost"]', '[class*="amount"]', '.amount'],
                brand: ['.brand', '[class*="brand"]', '[class*="manufacturer"]', '.manufacturer'],
                image: ['img', '.product-image img', '[class*="image"] img', '.gallery img']
            };
            
            const results = {};
            Object.entries(selectors).forEach(([key, selectorList]) => {
                for (const selector of selectorList) {
                    const element = document.querySelector(selector);
                    if (element) {
                        if (key === 'price') {
                            const priceText = element.textContent?.replace(/[^0-9.]/g, '') || '0';
                            results[key] = parseFloat(priceText);
                        } else if (key === 'image') {
                            results[key] = element.src || element.getAttribute('src') || '';
                        } else {
                            results[key] = element.textContent?.trim() || '';
                        }
                        break;
                    }
                }
            });
            return results;
        });

        console.log('\nAlternative selector results:');
        Object.entries(alternativeData).forEach(([key, value]) => {
            console.log(`${key}:`, value);
        });

        const wouldSave = currentData.name && currentData.price > 0;
        console.log(`\nWould save product: ${wouldSave}`);
        if (!wouldSave) {
            console.log('❌ Product will NOT be saved because:');
            if (!currentData.name) console.log('  - Missing name');
            if (currentData.price <= 0) console.log('  - Missing or invalid price');
        }

        await browser.close();
        console.log('\n✅ Debug completed');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        if (browser) {
            await browser.close();
        }
    }
}

debugProductData();
