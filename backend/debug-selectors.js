console.log('=== Debugging SportVision Selectors ===');

const puppeteer = require('puppeteer');

async function debugSelectors() {
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

        console.log('3. Analyzing page structure...');
        
        // Check what links exist
        const allLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href]'));
            return links.slice(0, 10).map(link => ({
                href: link.href,
                text: link.textContent?.trim().substring(0, 50),
                classes: link.className
            }));
        });
        
        console.log('First 10 links found:');
        allLinks.forEach((link, i) => {
            console.log(`${i + 1}. ${link.href} | "${link.text}" | classes: ${link.classes}`);
        });

        // Check for different product link patterns
        const productPatterns = await page.evaluate(() => {
            const patterns = [
                'a[href*="/product/"]',
                'a[href*="product"]',
                '.product-item a',
                '.product-item-link',
                'a.product-item-link',
                '[data-testid*="product"]',
                '.product-card a',
                '.item a'
            ];
            
            const results = {};
            patterns.forEach(pattern => {
                const elements = document.querySelectorAll(pattern);
                results[pattern] = elements.length;
            });
            return results;
        });

        console.log('\nProduct link pattern matches:');
        Object.entries(productPatterns).forEach(([pattern, count]) => {
            console.log(`${pattern}: ${count} matches`);
        });

        // Check for any elements with "product" in class or id
        const productElements = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('*[class*="product"], *[id*="product"]'));
            return elements.slice(0, 5).map(el => ({
                tag: el.tagName,
                id: el.id,
                classes: el.className,
                text: el.textContent?.trim().substring(0, 30)
            }));
        });

        console.log('\nElements with "product" in class/id:');
        productElements.forEach((el, i) => {
            console.log(`${i + 1}. <${el.tag}> id="${el.id}" class="${el.classes}" text="${el.text}"`);
        });

        await browser.close();
        console.log('\n✅ Debug completed');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        if (browser) {
            await browser.close();
        }
    }
}

debugSelectors();
