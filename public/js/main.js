document.getElementById('platform').addEventListener('change', function () {
    var platform = this.value;
    var uploadSection = document.getElementById('upload-section');

    if (platform) {
        uploadSection.style.display = 'block';
    } else {
        uploadSection.style.display = 'none';
    }
});

function uploadFiles() {
    var formData = new FormData();
    var platform = document.getElementById('platform').value;
    var previousFile = document.getElementById('previous-version').files[0];
    var currentFile = document.getElementById('current-version').files[0];

    // Получение версий из текстовых полей
    var previousVersion = document.getElementById('previous-version-number').value;
    var currentVersion = document.getElementById('current-version-number').value;

    // Проверка наличия всех необходимых данных
    if (!platform || !previousFile || !currentFile || !previousVersion || !currentVersion) {
        alert('Пожалуйста, выберите платформу, укажите версии и загрузите оба файла.');
        return;
    }

    // Добавление данных в formData
    formData.append('platform', platform);
    formData.append('previousFile', previousFile);
    formData.append('currentFile', currentFile);
    formData.append('previousVersion', previousVersion);  // Добавление предыдущей версии
    formData.append('currentVersion', currentVersion);    // Добавление текущей версии

    // Отправка запроса
    fetch('/compare', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            var downloadMessage = document.getElementById('download-message');
            var downloadText = document.getElementById('download-text');
            var downloadLink = document.getElementById('download-link');

            downloadText.textContent = data.message;
            downloadLink.href = data.downloadLink;
            downloadLink.style.display = 'inline';
            downloadMessage.style.display = 'block';
        })
        .catch(error => console.error('Ошибка:', error));
}

function loadActualKeys() {
    fetch('/actual-keys')
        .then(response => response.json())
        .then(files => {
            const list = document.getElementById('actual-keys-list');
            list.innerHTML = '';

            const platforms = ['ios', 'android', 'web', 'desktop'];

            platforms.forEach(platform => {
                const row = document.createElement('tr');

                const platformCell = document.createElement('td');
                platformCell.textContent = platform.toUpperCase();
                row.appendChild(platformCell);

                const fileCell = document.createElement('td');
                const file = files.find(f => f.platform === platform);
                if (file) {
                    const link = document.createElement('a');
                    link.href = file.downloadLink;
                    link.textContent = file.filename;
                    fileCell.appendChild(link);
                } else {
                    fileCell.textContent = 'Файл не найден';
                }
                row.appendChild(fileCell);

                list.appendChild(row);
            });
        })
        .catch(error => console.error('Ошибка:', error));
}

// Функция для загрузки списка директорий и файлов
function loadDirectories() {
    fetch('/list-directories')
        .then(response => response.json())
        .then(data => {
            const list = document.getElementById('directory-list');
            list.innerHTML = ''; // Очищаем список перед загрузкой

            // Отображаем директории
            data.directories.forEach(dir => {
                const folderDiv = document.createElement('div');
                folderDiv.classList.add('folder');
                folderDiv.innerHTML = `
                    <div style="display: flex; align-items: center;">
                        <span class="icon"></span>
                        <span>${dir}</span>
                    </div>
                    <span class="arrow">▶</span>
                `;

                const fileListDiv = document.createElement('div');
                fileListDiv.classList.add('file-list');

                folderDiv.addEventListener('click', () => {
                    folderDiv.classList.toggle('open');
                    fileListDiv.classList.toggle('open');

                    // Загружаем файлы для выбранной папки
                    if (fileListDiv.innerHTML === '') {
                        loadFilesForDirectory(dir, fileListDiv);
                    }
                });

                list.appendChild(folderDiv);
                list.appendChild(fileListDiv);
            });
        })
        .catch(error => console.error('Ошибка:', error));
}

// Функция для загрузки файлов в директории
function loadFilesForDirectory(directory, fileListDiv) {
    fetch(`/list-files?directory=${encodeURIComponent(directory)}`)
        .then(response => response.json())
        .then(data => {
            fileListDiv.innerHTML = ''; // Очищаем список перед загрузкой

            if (data.files.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.classList.add('empty-message');
                emptyMessage.textContent = 'Нет файлов';
                fileListDiv.appendChild(emptyMessage);
            } else {
                data.files.forEach(file => {
                    const fileDiv = document.createElement('div');
                    fileDiv.classList.add('file');
                    fileDiv.innerHTML = `
                        <div style="display: flex; align-items: center;">
                            <span class="icon"></span>
                            <a href="/view-file?directory=${encodeURIComponent(directory)}&file=${encodeURIComponent(file)}" target="_blank">${file}</a>
                        </div>
                        <a href="/download-file?directory=${encodeURIComponent(directory)}&file=${encodeURIComponent(file)}" download>Скачать</a>
                    `;
                    fileListDiv.appendChild(fileDiv);
                });
            }
        })
        .catch(error => console.error('Ошибка при загрузке файлов:', error));
}

document.addEventListener('DOMContentLoaded', loadDirectories);


document.addEventListener('DOMContentLoaded', loadActualKeys);
