document.addEventListener("DOMContentLoaded", function () {
    // Ensure elements are loaded before running scripts
    loadDirectories();
    loadActualKeys();

    // Bind the uploadFiles function to the Compare button
    document.getElementById('compare-button').addEventListener('click', uploadFiles);

    document.getElementById('platform').addEventListener('change', function () {
        var platform = this.value;
        var uploadSection = document.getElementById('upload-section');

        if (platform) {
            uploadSection.style.display = 'block';
        } else {
            uploadSection.style.display = 'none';
        }
    });
});

function uploadFiles() {
    var formData = new FormData();
    var platform = document.getElementById('platform').value;
    var previousFile = document.getElementById('previous-version').files[0];
    var currentFile = document.getElementById('current-version').files[0];
    var previousVersion = document.getElementById('previous-version-number').value;
    var currentVersion = document.getElementById('current-version-number').value;
    var uploadToServer = document.getElementById('upload-to-server').checked;

    if (!platform || !previousFile || !currentFile || !previousVersion || !currentVersion) {
        alert('Please select a platform, specify versions, and upload both files.');
        return;
    }

    formData.append('platform', platform);
    formData.append('previousFile', previousFile);
    formData.append('currentFile', currentFile);
    formData.append('previousVersion', previousVersion);
    formData.append('currentVersion', currentVersion);
    formData.append('uploadToServer', uploadToServer);

    fetch('/compare', {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            var messageSection = document.querySelector('.message-section');
            var messageText = document.querySelector('.message-text');
            var viewFileLink = document.querySelector('.view-file-link');
            var downloadFileLink = document.querySelector('.download-file-link');
            var uploadStatus = document.querySelector('.upload-status');


            messageText.textContent = data.message;

            if (uploadToServer) {
                uploadStatus.style.display = 'block';
            } else {
                uploadStatus.style.display = 'none';
            }

            // Check if the "View file" link element exists and assign the URL for viewing the file
            if (viewFileLink) {
                viewFileLink.href = data.viewLink;
                viewFileLink.style.display = 'inline';
                viewFileLink.textContent = 'View file';
            }

            // Check if the "Download file" link element exists and assign the URL for downloading the file
            if (downloadFileLink) {
                downloadFileLink.href = data.downloadLink;
                downloadFileLink.style.display = 'inline';
                downloadFileLink.textContent = 'Download file';
            }

            // Display the message block with view and download options
            messageSection.style.display = 'block';
        })
        .catch(error => {
            console.error('Error:', error);
            alert('There was an error processing your request. Please try again.');
        });
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
                    fileCell.textContent = 'File not found';
                }
                row.appendChild(fileCell);

                list.appendChild(row);
            });
        })
        .catch(error => console.error('Error:', error));
}

// Function to load directory list
function loadDirectories() {
    fetch('/list-directories')
        .then(response => response.json())
        .then(data => {
            const list = document.getElementById('directory-list');
            list.innerHTML = ''; // Clear list before loading

            // Display directories
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

                    // Load files for selected directory
                    if (fileListDiv.innerHTML === '') {
                        loadFilesForDirectory(dir, fileListDiv);
                    }
                });

                list.appendChild(folderDiv);
                list.appendChild(fileListDiv);
            });
        })
        .catch(error => console.error('Error:', error));
}

// Function to load files in a directory
function loadFilesForDirectory(directory, fileListDiv) {
    fetch(`/list-files?directory=${encodeURIComponent(directory)}`)
        .then(response => response.json())
        .then(data => {
            fileListDiv.innerHTML = ''; // Clear list before loading

            if (data.files.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.classList.add('empty-message');
                emptyMessage.textContent = 'No files';
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
                        <a href="/download-file?directory=${encodeURIComponent(directory)}&file=${encodeURIComponent(file)}" download>Download</a>
                    `;
                    fileListDiv.appendChild(fileDiv);
                });
            }
        })
        .catch(error => console.error('Error loading files:', error));
}
