// DOM Elements
const fileInput = document.getElementById('pdf-file');
const loadButton = document.getElementById('load-pdf');
const dropZone = document.getElementById('drop-zone');
const pageSelection = document.getElementById('page-selection');
const totalPagesSpan = document.getElementById('total-pages');
const pagesInput = document.getElementById('pages');
const previewButton = document.getElementById('preview-pages');
const splitButton = document.getElementById('split-pdf');
const alertMessage = document.getElementById('alert-message');
const progressContainer = document.querySelector('.progress-container');
const progressBarInner = document.querySelector('.progress-bar-inner');
const progressText = document.querySelector('.progress-text');
const progressPercent = document.querySelector('.progress-percent');
const pagePreview = document.getElementById('page-preview');

// State variables
let loadedPdfDoc = null;
let pdfJsDoc = null;
let selectedPages = new Set();

// Event Listeners
loadButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

// Drag and Drop functionality
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

dropZone.addEventListener('drop', handleDrop, false);

previewButton.addEventListener('click', previewSelectedPages);
splitButton.addEventListener('click', splitPdf);

// Functions
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    dropZone.classList.add('active');
}

function unhighlight() {
    dropZone.classList.remove('active');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0 && files[0].type === 'application/pdf') {
        fileInput.files = files;
        handleFileSelect();
    } else {
        showAlert('Please drop a valid PDF file.', 'error');
    }
}

async function handleFileSelect() {
    const file = fileInput.files[0];
    if (!file || file.type !== 'application/pdf') {
        showAlert('Please select a valid PDF file.', 'error');
        return;
    }

    showProgress('Loading PDF...');
    
    try {
        // Load with PDF.js for preview
        const arrayBuffer = await file.arrayBuffer();
        pdfJsDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        // Load with PDF-lib for processing
        loadedPdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        
        const totalPages = loadedPdfDoc.getPageCount();
        totalPagesSpan.textContent = totalPages;
        pageSelection.style.display = 'block';
        
        // Reset previous selections
        pagesInput.value = '';
        selectedPages.clear();
        pagePreview.innerHTML = '';
        
        hideProgress();
        showAlert('PDF loaded successfully!', 'success');
    } catch (error) {
        console.error('Error loading PDF:', error);
        showAlert('Failed to load the PDF. Please try again.', 'error');
        hideProgress();
    }
}

async function previewSelectedPages() {
    if (!loadedPdfDoc || !pdfJsDoc) {
        showAlert('Please load a PDF first.', 'error');
        return;
    }

    try {
        const totalPages = loadedPdfDoc.getPageCount();
        const pageRanges = parsePageRanges(pagesInput.value, totalPages);
        
        // Clear previous preview
        pagePreview.innerHTML = '';
        selectedPages = new Set(pageRanges);
        
        showProgress('Generating preview...');
        
        // Render thumbnails for selected pages
        for (const pageNum of pageRanges) {
            const page = await pdfJsDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.2 });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            const thumbnail = document.createElement('div');
            thumbnail.className = 'page-thumbnail selected';
            thumbnail.innerHTML = `
                <canvas></canvas>
                <span class="page-number">${pageNum}</span>
            `;
            thumbnail.querySelector('canvas').getContext('2d').drawImage(canvas, 0, 0);
            
            // Add click handler to toggle selection
            thumbnail.addEventListener('click', () => togglePageSelection(pageNum, thumbnail));
            
            pagePreview.appendChild(thumbnail);
        }
        
        hideProgress();
    } catch (error) {
        showAlert(error.message, 'error');
        hideProgress();
    }
}

function togglePageSelection(pageNum, element) {
    if (selectedPages.has(pageNum)) {
        selectedPages.delete(pageNum);
        element.classList.remove('selected');
    } else {
        selectedPages.add(pageNum);
        element.classList.add('selected');
    }
    
    // Update the input field
    pagesInput.value = Array.from(selectedPages).sort((a, b) => a - b).join(',');
}

function parsePageRanges(input, totalPages) {
    if (!input.trim()) {
        throw new Error('Please enter page numbers.');
    }
    
    const ranges = input.split(',');
    const pages = new Set();
    
    for (const range of ranges) {
        if (range.includes('-')) {
            const [start, end] = range.split('-').map(Number);
            
            if (isNaN(start) || isNaN(end) || start > end || start < 1 || end > totalPages) {
                throw new Error(`Invalid page range: ${range}. Please use numbers between 1 and ${totalPages}.`);
            }
            
            for (let i = start; i <= end; i++) {
                pages.add(i);
            }
        } else {
            const page = Number(range);
            
            if (isNaN(page) || page < 1 || page > totalPages) {
                throw new Error(`Invalid page number: ${range}. Please use numbers between 1 and ${totalPages}.`);
            }
            
            pages.add(page);
        }
    }
    
    return Array.from(pages).sort((a, b) => a - b);
}

async function splitPdf() {
    if (!loadedPdfDoc) {
        showAlert('Please load a PDF first.', 'error');
        return;
    }

    try {
        const totalPages = loadedPdfDoc.getPageCount();
        let pageRanges;
        
        // Use either the input field or the selected thumbnails
        if (selectedPages.size > 0) {
            pageRanges = Array.from(selectedPages);
        } else {
            pageRanges = parsePageRanges(pagesInput.value, totalPages);
        }
        
        if (pageRanges.length === 0) {
            throw new Error('Please select at least one page to split.');
        }
        
        showProgress('Creating new PDF...');
        
        const newPdfDoc = await PDFLib.PDFDocument.create();
        let processed = 0;
        
        for (const pageIndex of pageRanges) {
            const [page] = await newPdfDoc.copyPages(loadedPdfDoc, [pageIndex - 1]);
            newPdfDoc.addPage(page);
            
            // Update progress
            processed++;
            const progress = Math.round((processed / pageRanges.length) * 100);
            updateProgress(progress);
        }
        
        updateProgress(100);
        showAlert(`Processing complete. Saving ${pageRanges.length} pages...`, 'success');
        
        const newPdfBytes = await newPdfDoc.save();
        await saveFile(newPdfBytes, `split_pages_${pageRanges.join('_')}.pdf`);
        
        hideProgress();
    } catch (error) {
        showAlert(error.message, 'error');
        hideProgress();
    }
}

async function saveFile(data, defaultName) {
    try {
        if (window.showSaveFilePicker) {
            const handle = await window.showSaveFilePicker({
                suggestedName: defaultName,
                types: [{
                    description: "PDF Files",
                    accept: { "application/pdf": [".pdf"] },
                }],
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
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            showAlert("File downloaded successfully!", 'success');
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("File save error:", error);
            showAlert("File save canceled or failed.", 'error');
        }
    }
}

function showProgress(message) {
    progressText.textContent = message;
    progressPercent.textContent = '0%';
    progressBarInner.style.width = '0%';
    progressContainer.style.display = 'block';
}

function updateProgress(percent) {
    progressBarInner.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
}

function hideProgress() {
    setTimeout(() => {
        progressContainer.style.display = 'none';
    }, 500);
}

function showAlert(message, type) {
    alertMessage.textContent = message;
    alertMessage.className = `alert ${type}`;
    alertMessage.style.display = 'block';
    
    // Hide after 5 seconds
    setTimeout(() => {
        alertMessage.style.display = 'none';
    }, 5000);
}

// Clean up resources when page is unloaded
window.addEventListener('beforeunload', () => {
    if (loadedPdfDoc) {
        loadedPdfDoc.cleanup();
    }
});