import { absoluteUrl, cleanText, labelsFromSpecs, parsePrice, readBreadcrumbs } from '../core/extract';
import type { Extractor } from '../core/types';

/**
 * Platform extractors. Several Macedonian shops run on the same e-commerce platform,
 * so one extractor covers multiple stores. For an unknown platform, leave `extractor`
 * unset in the site config: the generic JSON-LD/OpenGraph/spec-table extractor is used.
 */

/** "nbshop" platform: Sport Vision, Sport Reality, Buzz Sneakers. Publishes JSON-LD Product. */
export const nbshopExtractor: Extractor = ({ $, url, structured, specs }) => {
    const fromSpecs = labelsFromSpecs(specs);
    // Breadcrumbs: "Store / Производи / Обувки / Патики" -> drop the first two.
    const breadcrumbs = readBreadcrumbs($, '.block.breadcrumbs a').slice(2);
    const image =
        structured.image ||
        absoluteUrl(
            $('img')
                .map((_, img) => $(img).attr('data-original-img') || $(img).attr('data-src') || $(img).attr('src'))
                .get()
                .find((src) => /\/(files\/thumbs|slike-proizvoda|slike_proizvoda)\//.test(src) && !src.endsWith('.svg')),
            url,
        );
    return {
        name: cleanText($('h1').first().text()) || structured.name,
        brand: fromSpecs.brand || structured.brand,
        code: cleanText($('.code span').first().text()) || fromSpecs.code || structured.sku,
        // JSON-LD price is the main product's; `.current-price` also matches related-product carousels.
        price: structured.price ?? parsePrice($('.product-price-value').first().text()),
        image,
        labels: { ...fromSpecs.labels, breadcrumbs },
    };
};

/** "OW" ASP.NET catalog platform: Sizeer, Sport M. */
export const owCatalogExtractor: Extractor = ({ $, url }) => {
    const productId = url.match(/ProductID=([^&]+)/)?.[1];
    const codeText = cleanText($('.ow-colors-text').text());
    const code = codeText.match(/Шифра на производ:\s*([A-Za-z0-9-]+)/)?.[1] || productId;
    const origin = new URL(url).origin;

    // Sport M: labelled spec list. Sizeer: positional feature list.
    const keyed: Record<string, string> = {};
    $('#collapseOpis ul li').each((_, li) => {
        const key = cleanText($(li).find('.opis').text());
        const value = cleanText($(li).find('span').last().text());
        if (key && value) keyed[key] = value;
    });
    let labels;
    let brand: string | undefined;
    if (Object.keys(keyed).length) {
        labels = { age: keyed['Возраст'], gender: keyed['Пол'], color: keyed['Боја'], subcategory: keyed['Подгрупа'] };
        brand = keyed['Бренд'];
    } else {
        const f = $('#ow-feature-name ul li')
            .map((_, li) => cleanText($(li).text()))
            .get();
        // [age, gender, color, material, subcategory, sport, brand]
        labels = { age: f[0], gender: f[1], color: f[2], subcategory: f[4] };
        brand = f[6];
    }

    const priceText =
        $('.price-withdiscount-product-details').first().text() ||
        $('span.price-withdiscount[id$="Price"]').first().text() ||
        $('div.normal-price[id$="Price"]').first().text() ||
        $('.normal-price').first().text();

    return {
        name: cleanText($('h2.details_description').first().text()),
        brand,
        code,
        price: parsePrice(priceText),
        // Use the image the page actually shows; the file extension changed (.jpg -> .webp) before,
        // so never guess it unless the page has no product image at all.
        image:
            absoluteUrl(
                $(`img[src*="/ProductImages/${productId}."]`).first().attr('src') ||
                    $(`img[data-src*="/ProductImages/${productId}."]`).first().attr('data-src'),
                url,
            ) || (productId ? `${origin}/ProductImages/${productId}.webp` : null),
        labels,
    };
};

/** Magento 2: D Sport. */
export const magentoExtractor: Extractor = ({ $, structured }) => {
    const specs: Record<string, string> = {};
    $('table.technical-specifications-options tr, table.additional-attributes tr').each((_, tr) => {
        const key = cleanText($(tr).find('th, td strong').first().text()).replace(/:$/, '');
        const val = cleanText($(tr).find('td').last().text());
        if (key && val) specs[key] = val;
    });
    const fromSpecs = labelsFromSpecs(specs);
    const priceText =
        $('.product-info-price .special-price .price').first().text() ||
        $('.product-info-price .price-final_price .price').first().text() ||
        $('.product-info-price .price').first().text();
    return {
        name: cleanText($('h1.page-title span.base').first().text() || $('h1').first().text()) || structured.name,
        brand: fromSpecs.brand || structured.brand,
        code: cleanText($('div.product.attribute.sku .value').first().text()) || fromSpecs.code || structured.sku,
        price: parsePrice(priceText) ?? structured.price,
        image: absoluteUrl($('img.fotorama__img').first().attr('src') || $('meta[property="og:image"]').attr('content'), 'https://www.dsport.mk/'),
        labels: fromSpecs.labels,
    };
};
