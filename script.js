const fileInput = document.getElementById('pdf-file');
const loadButton = document.getElementById('load-pdf');
const pageSelection = document.getElementById('page-selection');
const totalPagesSpan = document.getElementById('total-pages');
const pagesInput = document.getElementById('pages');
const splitButton = document.getElementById('split-pdf');
const alertMessage = document.getElementById('alert-message');
const progressContainer = document.querySelector('.progress-container');
const progressBarInner = document.querySelector('.progress-bar-inner');
const progressText = document.querySelector('.progress-text');

let loadedPdfDoc; 

loadButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file || file.type !== 'application/pdf') {
        showAlert('Please upload a valid PDF file.', 'error');
        return;
    }

    progressContainer.style.display = 'flex';

    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        progressBarInner.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
        if (progress >= 100) {
            clearInterval(interval);
        }
    }, 200);

    try {
        const arrayBuffer = await file.arrayBuffer();
        loadedPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

        clearInterval(interval);
        progressContainer.style.display = 'none';
        progressBarInner.style.width = '0%';
        progressText.textContent = '0%';

        const totalPages = loadedPdfDoc.getPageCount();
        totalPagesSpan.textContent = totalPages;
        pageSelection.style.display = 'block';
        showAlert('PDF loaded successfully!', 'success');
    } catch (error) {
        showAlert('Failed to load the PDF. Please try again.', 'error');
        progressContainer.style.display = 'none';
    }
});

splitButton.addEventListener('click', async () => {
    if (!loadedPdfDoc) {
        showAlert('Please load a PDF first.', 'error');
        return;
    }

    try {
        const pageRanges = parsePageRanges(pagesInput.value, loadedPdfDoc.getPageCount());
        const newPdfDoc = await PDFLib.PDFDocument.create();

        for (const pageIndex of pageRanges) {
            const [page] = await newPdfDoc.copyPages(loadedPdfDoc, [pageIndex - 1]);
            newPdfDoc.addPage(page);
        }

        const newPdfBytes = await newPdfDoc.save();
        saveFile(newPdfBytes, "split.pdf");

        pagesInput.value = '';
    } catch (error) {
        showAlert(error.message, 'error');
    }
});

function parsePageRanges(input, totalPages) {
    const ranges = input.split(',');
    const pages = new Set();

    ranges.forEach(range => {
        if (range.includes('-')) {
            const [start, end] = range.split('-').map(Number);
            if (start > end || start < 1 || end > totalPages) {
                throw new Error('Invalid page range.');
            }
            for (let i = start; i <= end; i++) {
                pages.add(i);
            }
        } else {
            const page = Number(range);
            if (page < 1 || page > totalPages) {
                throw new Error('Invalid page number.');
            }
            pages.add(page);
        }
    });

    return [...pages];
}

async function saveFile(data, defaultName) {
    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [
                    {
                        description: "PDF Files",
                        accept: { "application/pdf": [".pdf"] },
                    },
                ],
            });

            const writable = await handle.createWritable();
            await writable.write(data);
            await writable.close();
            showAlert("File saved successfully!", 'success');
        } else {
            const blob = new Blob([data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showAlert("File downloaded successfully!", 'success');
        }
    } catch (error) {
        console.error("File save canceled or failed:", error);
        showAlert("File save canceled or failed.", 'error');
    }
}

function showAlert(message, type) {
    alertMessage.textContent = message;
    alertMessage.className = `alert ${type}`;
    alertMessage.style.display = 'block';
    setTimeout(() => {
        alertMessage.style.display = 'none';
    }, 3000);
}