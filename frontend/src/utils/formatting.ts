export function capitalizeBrand(brand: string): string {
    if (!brand) return brand;
    
    const lowercaseWords = new Set(['the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'under', 'over']);
    
    return brand
        .split(' ')
        .map((word, index) => {
            if (!word) return word;
            
            if (index === 0 || !lowercaseWords.has(word.toLowerCase())) {
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }
            
            return word.toLowerCase();
        })
        .join(' ');
}

export function capitalizeFirstLetter(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
