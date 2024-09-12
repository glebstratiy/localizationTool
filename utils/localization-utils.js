const fs = require('fs');
const xml2js = require('xml2js');

// Функция для чтения и парсинга файла локализации iOS (.strings)
function parseIOSLocalizationFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const localization = {};

    lines.forEach(line => {
        const match = line.match(/"(.+)"\s*=\s*"(.+)";/);
        if (match) {
            const key = match[1];
            const value = match[2];
            localization[key] = value;
        }
    });

    return localization;
}

// Функция для чтения и парсинга файла локализации Android (XML)
function parseAndroidLocalizationFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const parser = new xml2js.Parser();
    let localization = {};

    parser.parseString(content, (err, result) => {
        if (err) {
            throw new Error('Failed to parse XML file: ' + err.message);
        }

        const strings = result.resources.string;
        strings.forEach(item => {
            const key = item.$.name;
            const value = item._;
            localization[key] = value;
        });
    });

    return localization;
}

// Функция для нормализации ключей и значений только для WEB
function normalizeKeyForWeb(key) {
    return key.replace(/['"]/g, '').trim().toLowerCase(); // Убираем кавычки и пробелы, приводим к нижнему регистру
}

function normalizeValueForWeb(value) {
    return value.replace(/['"]/g, '').trim(); // Убираем кавычки и пробелы
}

// Функция для чтения и парсинга файла локализации для WEB (JavaScript .js)
function parseWebLocalizationFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const localization = {};

    // Улучшенное регулярное выражение для парсинга объекта `en`
    const match = content.match(/export\s+(let|const)\s+en\s*=\s*{([\s\S]+)};/);

    if (match) {
        const objectContent = match[2]; // Извлекаем содержимое объекта
        // Обновленное регулярное выражение для поиска всех ключей и значений
        const keyValuePairs = objectContent.match(/['"]?(.+?)['"]?\s*:\s*['"]?([^'",]+)['"]?(,|\n)?/g);

        if (keyValuePairs) {
            keyValuePairs.forEach(pair => {
                const [_, key, value] = pair.match(/['"]?(.+?)['"]?\s*:\s*['"]?([^'",]+)['"]?(,|\n)?/); // Парсим ключ и значение
                localization[normalizeKeyForWeb(key)] = normalizeValueForWeb(value); // Нормализуем ключи и значения только для веба
            });
        } else {
            console.error('Ключи и значения не найдены в объекте.');
        }
    } else {
        console.error('Объект `en` не найден в файле.');
    }

    return localization;
}

// Функция для чтения и парсинга файла локализации для Desktop (.properties)
function parseDesktopLocalizationFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const localization = {};

    lines.forEach(line => {
        const match = line.match(/(.+?)\s*=\s*(.+)/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            localization[key] = value;
        }
    });

    return localization;
}

// Функция для сравнения локализаций
function compareLocalizations(oldLocalization, newLocalization, platform) {
    const differences = {
        added: {},
        removed: {},
        changed: {}
    };

    // Проверяем удаленные и измененные ключи
    for (const key in oldLocalization) {
        const normalizedKey = platform === 'web' ? normalizeKeyForWeb(key) : key;
        if (!newLocalization.hasOwnProperty(normalizedKey)) {
            differences.removed[normalizedKey] = oldLocalization[key];
        } else if (oldLocalization[key] !== newLocalization[normalizedKey]) {
            differences.changed[normalizedKey] = {
                old: oldLocalization[key],
                new: newLocalization[normalizedKey]
            };
        }
    }

    // Проверяем добавленные ключи
    for (const key in newLocalization) {
        const normalizedKey = platform === 'web' ? normalizeKeyForWeb(key) : key;
        if (!oldLocalization.hasOwnProperty(normalizedKey)) {
            differences.added[normalizedKey] = newLocalization[normalizedKey];
        }
    }

    return differences;
}

// Сохранение отличий в файл
function saveDifferences(differences, outputPath) {
    const content = JSON.stringify(differences, null, 2);
    fs.writeFileSync(outputPath, content);
}

module.exports = {
    parseIOSLocalizationFile,
    parseAndroidLocalizationFile,
    parseWebLocalizationFile,
    parseDesktopLocalizationFile,
    compareLocalizations,
    saveDifferences
};
