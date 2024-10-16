const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sftpClient = require('ssh2-sftp-client');
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

const dbURI = 'mongodb+srv://admin:admin@cluster0.hxfn3.mongodb.net/';
mongoose.connect(dbURI, {})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.log('MongoDB connection error:', err));

// SFTP параметры
const sftpConfig = {
    host: 'files.traderevolution.com',
    port: '22',
    username: 'release',
    password: 'Wetfg#432!qd'
};

// Подключение к SFTP серверу
const sftp = new sftpClient();

// Обслуживание статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Маршрут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Маршрут для обработки сравнения файлов
app.post('/compare', upload.fields([{ name: 'previousFile' }, { name: 'currentFile' }]), async (req, res) => {
    const platform = req.body.platform;
    const previousVersion = req.body.previousVersion; // Пример: 114
    const currentVersion = req.body.currentVersion;   // Пример: 115
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

    const differences = compareLocalizations(previousLocalization, currentLocalization, platform);

    // Формирование имени файла с датой и временем
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const differencesFilename = `${platform}_localization_diff${previousVersion}-${currentVersion}.json`;
    const differencesPath = path.join(__dirname, 'results', differencesFilename);

    // Сохранение результатов сравнения в файл
    saveDifferences(differences, differencesPath);

    // Создание папки на сервере с версиями
    const remoteDir = `/ftp/releases/te/localization_keys_diff/${previousVersion}-${currentVersion}`;

    try {
        // Подключение к SFTP и создание директории, если она не существует
        await sftp.connect(sftpConfig);

        const remoteDirExists = await sftp.exists(remoteDir);
        if (!remoteDirExists) {
            await sftp.mkdir(remoteDir, true); // Создаем директорию с родительскими
        }

        // Загрузка файла в новую директорию на сервере
        await sftp.put(differencesPath, `${remoteDir}/${differencesFilename}`);
        await sftp.end(); // Закрываем подключение к SFTP
    } catch (err) {
        console.error('Ошибка при работе с SFTP:', err);
        return res.status(500).send('Ошибка при загрузке файла на сервер.');
    }

    // Обновление или вставка нового файла для конкретной платформы в MongoDB
    const fileData = fs.readFileSync(currentFilePath);
    await LocalizationFile.findOneAndUpdate(
        { platform: platform },
        { platform: platform, filename: path.basename(savePath), data: fileData },
        { upsert: true, new: true }
    );

    // Перемещение нового файла в корневую директорию
    fs.renameSync(currentFilePath, savePath);

    // Отправка ответа с ссылкой на скачивание файла
    res.json({
        message: 'Файл готов к скачиванию и загружен на сервер.',
        downloadLink: `/download/${differencesFilename}`,
        remotePath: `${remoteDir}/${differencesFilename}` // Путь на сервере
    });
});

// Новый маршрут для получения списка папок и файлов
app.get('/list-directories', async (req, res) => {
    const remoteBaseDir = '/ftp/releases/te/localization_keys_diff';

    try {
        // Подключаемся к SFTP серверу
        await sftp.connect(sftpConfig);

        // Получаем список директорий и файлов
        const items = await sftp.list(remoteBaseDir);

        // Формируем ответ, возвращаем только директории и файлы
        const directories = items.filter(item => item.type === 'd').map(item => item.name);
        const files = items.filter(item => item.type === '-').map(item => item.name);

        await sftp.end(); // Закрываем подключение к SFTP

        res.json({ directories, files });
    } catch (err) {
        console.error('Ошибка при работе с SFTP:', err);
        res.status(500).send('Не удалось получить список директорий и файлов.');
    }
});

// Маршрут для получения файлов в указанной директории
app.get('/list-files', async (req, res) => {
    const directory = req.query.directory;
    const remoteDir = `/ftp/releases/te/localization_keys_diff/${directory}`;

    try {
        // Подключаемся к SFTP серверу
        await sftp.connect(sftpConfig);

        // Получаем список файлов
        const items = await sftp.list(remoteDir);
        const files = items.filter(item => item.type === '-').map(item => item.name);

        await sftp.end(); // Закрываем подключение

        res.json({ files });
    } catch (err) {
        console.error('Ошибка при работе с SFTP:', err);
        res.status(500).send('Не удалось получить список файлов.');
    }
});

// Маршрут для скачивания файла
app.get('/download-file', async (req, res) => {
    const directory = req.query.directory;
    const file = req.query.file;
    const remoteFilePath = `/ftp/releases/te/localization_keys_diff/${directory}/${file}`;
    const localDirPath = path.join(__dirname, 'downloads');
    const localFilePath = path.join(__dirname, 'downloads', file);

    if (!fs.existsSync(localDirPath)) {
        fs.mkdirSync(localDirPath, { recursive: true });
    }

    try {
        // Подключаемся к SFTP серверу
        await sftp.connect(sftpConfig);

        // Загружаем файл с SFTP на локальный сервер
        await sftp.fastGet(remoteFilePath, localFilePath);
        await sftp.end(); // Закрываем подключение

        // Отправляем файл на скачивание пользователю
        res.download(localFilePath, (err) => {
            if (err) {
                console.error('Ошибка при скачивании файла:', err);
                res.status(500).send('Не удалось скачать файл.');
            }

            // Удаляем файл после скачивания
            fs.unlinkSync(localFilePath);
        });
    } catch (err) {
        console.error('Ошибка при работе с SFTP:', err);
        res.status(500).send('Не удалось скачать файл.');
    }
});

// Маршрут для открытия содержимого файла в браузере
app.get('/view-file', async (req, res) => {
    const directory = req.query.directory;
    const file = req.query.file;
    const remoteFilePath = `/ftp/releases/te/localization_keys_diff/${directory}/${file}`;

    try {
        // Подключаемся к SFTP серверу
        await sftp.connect(sftpConfig);

        // Загружаем содержимое файла в буфер
        const fileContent = await sftp.get(remoteFilePath);

        await sftp.end(); // Закрываем подключение

        // Отправляем содержимое файла в ответе
        res.setHeader('Content-Type', 'text/plain'); // Устанавливаем тип содержимого как текст
        res.send(fileContent.toString('utf-8')); // Отправляем содержимое как текст
    } catch (err) {
        console.error('Ошибка при открытии файла:', err);
        res.status(500).send('Не удалось открыть файл.');
    }
});


// Запуск сервера
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
