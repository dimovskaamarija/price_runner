/**
 * Canonical taxonomy — the single source of truth for categories shown in the UI.
 *
 * Rule dictionaries below resolve the common raw labels for free. Anything they
 * don't recognise is sent to Gemini (constrained to these exact enum values) and
 * the answer is cached in `category_mappings`, so a new store "just works" after
 * its first scrape without editing this file.
 */

export const CATEGORIES = ['Обувки', 'Текстил', 'Опрема'] as const;
export type Category = (typeof CATEGORIES)[number];

export const GENDERS = ['Машки', 'Женски', 'Унисекс'] as const;
export const AGES = ['За возрасни', 'За деца'] as const;

export const OTHER_SUBCATEGORY = 'Останато';

/** Nav-menu group for equipment subcategories. */
export type EquipmentGroup = 'dodatoci' | 'sports';

interface SubcategoryDef {
    category: Category;
    group?: EquipmentGroup;
    /** Raw labels (Macedonian + English), matched as whole words after normalization. */
    keywords: string[];
}

export const SUBCATEGORIES: Record<string, SubcategoryDef> = {
    // ----- Обувки -----
    Патики: {
        category: 'Обувки',
        keywords: [
            'патики', 'патика', 'спринтерици', 'патики ниски', 'патики високи', 'фудбал сала',
            'патики за вештачка трева', 'патики за трчање', 'патики за шетање', 'патики за кошарка',
            'патики за фудбал', 'патики за ракомет', 'обувки за фудбал', 'балетанки', 'sneakers', 'sneaker',
            'running shoes', 'trainers', 'shoes',
        ],
    },
    Копачки: { category: 'Обувки', keywords: ['копачки', 'копачка', 'фудбал копачки', 'football boots', 'cleats'] },
    'Кондури и чизми': { category: 'Обувки', keywords: ['кондури', 'чизми', 'чевли', 'boots', 'boot'] },
    'Папучи и сандали': {
        category: 'Обувки',
        keywords: ['папучи', 'папуча', 'сандали', 'сандала', 'апостолки', 'обувки за вода', 'slides', 'slide', 'sandals', 'flip flops', 'slippers'],
    },

    // ----- Текстил -----
    Дуксери: { category: 'Текстил', keywords: ['дуксери', 'дуксер', 'блузон', 'блузони', 'софтшел', 'полари', 'полар', 'џемпер', 'џемпери', 'кардиган', 'hoodie', 'sweatshirt', 'fleece'] },
    Маици: { category: 'Текстил', keywords: ['маица', 'маици', 'поло маици', 'поло маица', 'потковашка', 't shirt', 'tee', 'tank top', 'polo'] },
    'Маици со долги ракави': {
        category: 'Текстил',
        keywords: ['маица со долги ракави', 'маици со долги ракави', 'маица долги ракави', 'маици долги ракави', 'long sleeve'],
    },
    'Долен дел тренерки': {
        category: 'Текстил',
        keywords: ['долен дел тренерки', 'долни делови тренерки', 'долен дел тренерка', 'долница', 'joggers', 'track pants', 'sweatpants'],
    },
    Тренерки: { category: 'Текстил', keywords: ['тренерки', 'тренерка', 'комплет тренерки', 'tracksuit'] },
    'Јакни и елеци': {
        category: 'Текстил',
        keywords: ['јакни', 'јакна', 'елек', 'елеци', 'шушкавец', 'шушкавци', 'заштитен сет за дожд', 'ветровка', 'ветровки', 'jacket', 'vest', 'gilet', 'parka', 'windbreaker'],
    },
    Панталони: { category: 'Текстил', keywords: ['панталони', 'панталона', 'фармерки', 'фармерке', 'pants', 'trousers', 'jeans'] },
    Шорцеви: { category: 'Текстил', keywords: ['шорцеви', 'шорц', 'шорцеви за пливање', 'shorts'] },
    Хеланки: { category: 'Текстил', keywords: ['хеланки', 'хеланка', 'бициклистички', 'бицисклистички', 'leggings', 'tights'] },
    Градник: { category: 'Текстил', keywords: ['градник', 'градници', 'спортски градници', 'топ', 'bra', 'sports bra'] },
    'Фустани и сукњи': {
        category: 'Текстил',
        keywords: ['фустан', 'фустани', 'сукња', 'сукњи', 'долг фустан', 'здолниште', 'здолништа', 'зидолништа', 'dress', 'skirt'],
    },
    'Костими за капење': { category: 'Текстил', keywords: ['костими за капење', 'костим за капење', 'бањарки', 'swimsuit', 'swimwear', 'bikini'] },
    Комбинезон: { category: 'Текстил', keywords: ['комбинезон', 'комбинезони', 'jumpsuit'] },
    'Долна облека': { category: 'Текстил', keywords: ['долна облека', 'боди', 'гаќи', 'боксерки', 'underwear', 'boxers', 'briefs'] },
    Комплети: { category: 'Текстил', keywords: ['комплети', 'комплет', 'шорц и маица', 'летни комплети', 'set'] },
    'Активна облека': { category: 'Текстил', keywords: ['активна облека', 'облека за вежбање'] },
    Дресови: { category: 'Текстил', keywords: ['дрес', 'дресови', 'дресови фудбал', 'jersey'] },

    // ----- Опрема: додатоци -----
    Чорапи: { category: 'Опрема', group: 'dodatoci', keywords: ['чорапи', 'чорап', 'socks'] },
    'Качкети и капи': {
        category: 'Опрема',
        group: 'dodatoci',
        keywords: ['качкет', 'качкети', 'капа', 'капи', 'зимска капа', 'зимски капи', 'cap', 'beanie', 'hat'],
    },
    Ранец: { category: 'Опрема', group: 'dodatoci', keywords: ['ранец', 'ранци', 'backpack'] },
    'Торби и торбици': {
        category: 'Опрема',
        group: 'dodatoci',
        keywords: ['торба', 'торби', 'торбица', 'торбици', 'торбичка', 'торбички', 'несесер', 'bag', 'duffel', 'pouch'],
    },
    Бандани: { category: 'Опрема', group: 'dodatoci', keywords: ['бандана', 'бандани', 'маски', 'заштитна маска за лице', 'headband'] },
    Шалови: { category: 'Опрема', group: 'dodatoci', keywords: ['шал', 'шалови', 'scarf', 'neck warmer'] },
    Ракавици: { category: 'Опрема', group: 'dodatoci', keywords: ['ракавици', 'нараквици', 'gloves'] },
    Врвки: { category: 'Опрема', group: 'dodatoci', keywords: ['врвки', 'врвци', 'laces'] },

    // ----- Опрема: спорт -----
    Топки: { category: 'Опрема', group: 'sports', keywords: ['топка', 'топки', 'ball'] },
    'Опрема за пливање': {
        category: 'Опрема',
        group: 'sports',
        keywords: ['наочари за пливање', 'капа за пливање', 'чепови за уши', 'штипка за нос', 'маска и пераи', 'пераи', 'пешкир', 'goggles', 'towel'],
    },
    'Опрема за тренинг': {
        category: 'Опрема',
        group: 'sports',
        keywords: [
            'вреќа за тренинг', 'голмански ракавици', 'голманска ракавица', 'фитнес топка', 'подлога', 'костобрани',
            'држачи за склекови', 'фитнес реквизит', 'шипка за вежбање', 'бандажер', 'наочари за скијање', 'тегови',
            'вијача', 'ластик', 'crep protect', 'shin guards', 'yoga mat', 'dumbbell',
        ],
    },
    Шишиња: { category: 'Опрема', group: 'sports', keywords: ['шише', 'шишиња', 'шише за вода', 'термос', 'bottle'] },
    Ролери: { category: 'Опрема', group: 'sports', keywords: ['ролери', 'ролерки', 'рошули', 'inline skates'] },
    Тротинет: { category: 'Опрема', group: 'sports', keywords: ['тротинет', 'тротинети', 'scooter'] },
    Скироли: { category: 'Опрема', group: 'sports', keywords: ['скироли', 'скејтборд', 'skateboard'] },
    [OTHER_SUBCATEGORY]: { category: 'Опрема', group: 'sports', keywords: [] },
};

export const SUBCATEGORY_NAMES = Object.keys(SUBCATEGORIES);

export const CATEGORY_KEYWORDS: Record<Category, string[]> = {
    Обувки: ['обувки', 'обувка', 'obuvki', 'obuca', 'footwear', 'shoes'],
    Текстил: ['текстил', 'облека', 'tekstil', 'odeca', 'clothing', 'apparel'],
    Опрема: ['опрема', 'додатоци', 'oprema', 'equipment', 'accessories'],
};

export const GENDER_KEYWORDS: Record<string, string[]> = {
    Машки: ['машки', 'машка', 'мажи', 'за мажи', 'момчиња', 'за момчиња', 'деца момчиња', 'male', 'men', 'mens', 'man', 'boys', 'boy'],
    Женски: ['женски', 'женска', 'жени', 'за жени', 'девојчиња', 'за девојчиња', 'деца девојчиња', 'female', 'women', 'womens', 'woman', 'girls', 'girl', 'ladies', 'wmns'],
    // Kids items without a boy/girl split are unisex; "деца девојчиња" etc. win as longer phrases.
    Унисекс: ['унисекс', 'unisex', 'деца', 'детски', 'kids'],
};

export const AGE_KEYWORDS: Record<string, string[]> = {
    'За деца': [
        'деца', 'детски', 'детска', 'за деца', 'бебиња', 'бебе', 'тинејџери', 'мали деца', 'момчиња', 'девојчиња',
        'kids', 'kid', 'junior', 'jr', 'youth', 'baby', 'infant', 'toddler', 'gs', 'ps', 'td',
    ],
    'За возрасни': ['за возрасни', 'возрасни', 'adult', 'adults', 'мажи', 'жени', 'машки', 'женски', 'men', 'women'],
};

export const COLORS: Record<string, string[]> = {
    Беж: ['беж', 'крем', 'beige', 'cream', 'sand'],
    Бела: ['бела', 'бело', 'бел', 'white'],
    Бордо: ['бордо', 'burgundy', 'maroon'],
    Жолта: ['жолта', 'жолто', 'yellow'],
    Зелена: ['зелена', 'зелено', 'маслинеста', 'green', 'olive', 'khaki'],
    Златна: ['златна', 'златно', 'gold'],
    Кафеава: ['кафеава', 'кафена', 'кафеа', 'brown'],
    Виолетова: ['виолетова', 'лилакова', 'пурпурна', 'purple', 'violet', 'lilac'],
    Мултиколор: ['мултиколор', 'маскирна', 'повеќебоја', 'шарена', 'multicolor', 'multi', 'camo'],
    Сина: ['сина', 'сино', 'плава', 'светло сина', 'svetlo plava', 'тексас', 'blue', 'denim'],
    Портокалова: ['портокалова', 'портокалови', 'orange'],
    Розева: ['розева', 'розе', 'роза', 'pink'],
    Сива: ['сива', 'сиво', 'grey', 'gray'],
    Сребрена: ['сребрена', 'сребрено', 'silver'],
    Тегет: ['тегет', 'navy'],
    Црвена: ['црвена', 'црвено', 'red'],
    Црна: ['црна', 'црно', 'black'],
};

export const COLOR_NAMES = Object.keys(COLORS);
