const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
    parseIOSLocalizationFile,
    parseAndroidLocalizationFile,
    parseWebLocalizationFile,
    parseDesktopLocalizationFile,
    compareLocalizations,
    saveDifferences
} = require('./utils/localization-utils');
const LocalizationFile = require('./models/localizationFile');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Подключение к MongoDB
const dbURI = 'mongodb+srv://admin:admin@cluster0.hxfn3.mongodb.net/'; 
mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log('MongoDB connection error:', err));

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Маршрут для обработки сравнения файлов
app.post('/compare', upload.fields([{ name: 'previousFile' }, { name: 'currentFile' }]), async (req, res) => {
    const platform = req.body.platform;
    const previousFilePath = req.files['previousFile'][0].path;
    const currentFilePath = req.files['currentFile'][0].path;

    let parseFunction;
    let savePath;

    switch (platform) {
        case 'ios':
            parseFunction = parseIOSLocalizationFile;
            savePath = path.join(__dirname, 'Localizable.strings');
            break;
        case 'android':
            parseFunction = parseAndroidLocalizationFile;
            savePath = path.join(__dirname, 'full_strings.xml');
            break;
        case 'web':
            parseFunction = parseWebLocalizationFile;
            savePath = path.join(__dirname, 'application_es_properties.js');
            break;
        case 'desktop':
            parseFunction = parseDesktopLocalizationFile;
            savePath = path.join(__dirname, 'application_en.properties');
            break;
        default:
            return res.status(400).send('Неверная платформа.');
    }

    const previousLocalization = parseFunction(previousFilePath);
    const currentLocalization = parseFunction(currentFilePath);

    const differences = compareLocalizations(previousLocalization, currentLocalization);

    // Формирование имени файла с датой и временем
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const differencesFilename = `${platform}_localization_differences_${timestamp}.json`;
    const differencesPath = path.join(__dirname, 'results', differencesFilename);

    // Сохранение результатов сравнения в файл
    saveDifferences(differences, differencesPath);

    // Сохранение новой версии файла в корневом каталоге
    const newFile = new LocalizationFile({
        platform: platform,
        filename: path.basename(savePath),
        data: fs.readFileSync(currentFilePath)
    });

    // Удаление старого файла для платформы и сохранение нового
    await LocalizationFile.deleteMany({ platform: platform });
    await newFile.save();

    // Перемещение нового файла в корневую директорию
    fs.renameSync(currentFilePath, savePath);

    // Отправка ответа с ссылкой на скачивание файла
    res.json({
        message: 'Файл готов к скачиванию.',
        downloadLink: `/download/${differencesFilename}`
    });
});

// Маршрут для скачивания файла с различиями
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'results', req.params.filename);
    res.download(filePath, err => {
        if (err) {
            console.error('Ошибка при отправке файла:', err);
            res.status(500).send('Ошибка при отправке файла.');
        }
    });
});

// Маршрут для получения актуальных ключей
app.get('/actual-keys', async (req, res) => {
    const files = await LocalizationFile.find({});
    res.json(files.map(file => ({
        platform: file.platform,
        filename: file.filename,
        downloadLink: `/${file.filename}` // Ссылка на файл в корневой директории
    })));
});

// Маршрут для скачивания актуальных файлов
app.get('/:filename', async (req, res) => {
    const filePath = path.join(__dirname, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath, err => {
            if (err) {
                console.error('Ошибка при отправке файла:', err);
                res.status(500).send('Ошибка при отправке файла.');
            }
        });
    } else {
        res.status(404).send('Файл не найден.');
    }
});

// Запуск сервера
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
