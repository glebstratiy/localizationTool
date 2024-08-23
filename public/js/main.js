document.getElementById('platform').addEventListener('change', function() {
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

    if (!platform || !previousFile || !currentFile) {
        alert('Пожалуйста, выберите платформу и загрузите оба файла.');
        return;
    }

    formData.append('platform', platform);
    formData.append('previousFile', previousFile);
    formData.append('currentFile', currentFile);

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

document.addEventListener('DOMContentLoaded', loadActualKeys);
