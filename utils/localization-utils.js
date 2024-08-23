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

// Функция для чтения и парсинга файла локализации для WEB (JavaScript properties)
function parseWebLocalizationFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const localization = {};

    lines.forEach(line => {
        const match = line.match(/(.+?)\s*=\s*(.+)/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/['";]+/g, ''); // Убираем кавычки и точки с запятой
            localization[key] = value;
        }
    });

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

// Сравнение двух версий локализации
function compareLocalizations(oldLocalization, newLocalization) {
    const differences = {
        added: {},
        removed: {},
        changed: {}
    };

    for (const key in oldLocalization) {
        if (!newLocalization.hasOwnProperty(key)) {
            differences.removed[key] = oldLocalization[key];
        } else if (oldLocalization[key] !== newLocalization[key]) {
            differences.changed[key] = {
                old: oldLocalization[key],
                new: newLocalization[key]
            };
        }
    }

    for (const key in newLocalization) {
        if (!oldLocalization.hasOwnProperty(key)) {
            differences.added[key] = newLocalization[key];
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
