console.log('=== Debugging Pagination Structure ===');

const puppeteer = require('puppeteer');

async function debugPagination() {
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

        console.log('3. Looking for pagination elements...');
        
        // Check for pagination patterns
        const paginationPatterns = await page.evaluate(() => {
            const patterns = [
                '.pagination',
                '.pager',
                '.page-numbers',
                '.pagination-wrapper',
                '.pagination-container',
                '[class*="pagination"]',
                '[class*="pager"]',
                'a[href*="page"]',
                'a[href*="p="]',
                '.next',
                '.prev',
                '.page-next',
                '.page-prev'
            ];
            
            const results = {};
            patterns.forEach(pattern => {
                const elements = document.querySelectorAll(pattern);
                results[pattern] = {
                    count: elements.length,
                    text: elements.length > 0 ? elements[0].textContent?.trim() : null,
                    href: elements.length > 0 ? elements[0].href : null
                };
            });
            return results;
        });

        console.log('\nPagination pattern matches:');
        Object.entries(paginationPatterns).forEach(([pattern, result]) => {
            if (result.count > 0) {
                console.log(`${pattern}: ${result.count} matches - "${result.text}" - ${result.href}`);
            }
        });

        // Look for "Next" or ">" buttons
        const nextButtons = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('a, button'));
            return buttons
                .filter(btn => {
                    const text = btn.textContent?.toLowerCase().trim();
                    return text === 'next' || text === '>' || text === 'следна' || text === 'следна страница';
                })
                .map(btn => ({
                    text: btn.textContent?.trim(),
                    href: btn.href,
                    classes: btn.className
                }));
        });

        console.log('\nNext button candidates:');
        nextButtons.forEach((btn, i) => {
            console.log(`${i + 1}. "${btn.text}" - ${btn.href} - classes: ${btn.classes}`);
        });

        // Check URL patterns for pagination
        const currentUrl = page.url();
        console.log(`\nCurrent URL: ${currentUrl}`);

        await browser.close();
        console.log('\n✅ Pagination debug completed');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        if (browser) {
            await browser.close();
        }
    }
}

debugPagination();
