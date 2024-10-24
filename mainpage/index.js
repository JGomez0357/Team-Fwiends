const uploadBox = document.getElementById('upload'); // The whole upload box.
const fileInput = document.getElementById('uploadFile'); // The file(s) the user uploads.
const stagingBox = document.getElementById('staging'); // The staging box after users choose files.
const addMoreButton = document.getElementById('addMoreButton'); // button to add moore files
const resetButton = document.getElementById('resetButton'); // button to reset file upload

//FOR TESTING: REMOVE LATER
const logFiles = () => {
    console.clear();
    for (let i = 0; i < fileInput.files.length; i++) {
        console.log(`File ${i + 1}:`, fileInput.files[i]);
    }
};

// When the page is loaded...
document.addEventListener("DOMContentLoaded", function() {
    stagingBox.style.display = 'none'; // Hide the staging box
    uploadBox.addEventListener("click", function() { // The upload box when clicked will open the file explorer.
        fileInput.click();
    });
    addMoreButton.addEventListener('click', function(){ // The addMoreButton when clicked will open the file explorer.
        fileInput.click();
    })
    resetButton.addEventListener('click', function(){ // The resetButton when clicked will clear all file inputs and return to upload box.
        fileInput.value = '';
        fileList = [];
        uploadBox.style.display = 'flex';
        stagingBox.style.display = 'none';
    })
});

// After the user selects file(s), the upload box will disappear and the staging box will appear.
fileInput.addEventListener('change',(event) => {
    const files = event.target.files;

    if(files.length > 0){
        uploadBox.style.display = 'none';
        stagingBox.style.display = 'flex';
    }
})



/* -- file preview display -- */

let fileList = []; //create manual array to track user files

fileInput.addEventListener('change',function(){ //listen for changes in file input
    
    const filePreview = document.getElementById('filePreview');
    filePreview.innerHTML = ''; //clear display area

    // Create an array from the file input, For each file...
    Array.from(this.files).forEach(file => {
        // Ensure that files are not added twice
        if (!fileList.some(f => f.name === file.name && f.size === file.size)) { //no duplicates, return false
            fileList.push(file); //push the file into the fileList
            const dataTransfer = new DataTransfer();
            fileList.forEach(file => dataTransfer.items.add(file));
            fileInput.files = dataTransfer.files;
        }
    });

    // for each file input...
    fileList.forEach((file,index) => {

        // Create a div for the file
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        // Create a span that contains the data name of the file
        const fileDataName = document.createElement('span');
        fileDataName.textContent = `${file.name}`;

        // Create a span that contains the data size of the file
        const fileDataSize = document.createElement('span');
        fileDataSize.textContent = `${formatFileSize(file.size)}`;

        const fileDataContainer = document.createElement('div');
        fileDataContainer.className = 'file-data-container';
        fileDataContainer.appendChild(fileDataName);
        fileDataContainer.appendChild(fileDataSize);

        // Creat the delete button and add the image icon
        const deleteButton = document.createElement('button')
        deleteButton.className = 'delete-button';
        const img = document.createElement('img');
        img.src = '/assets/trashIcon.png';
        img.className = 'delete-button-img';
        deleteButton.appendChild(img);

        // event listener for delete button click
        deleteButton.addEventListener('click', function(){
            removeFile(index);
        });

        // Append file data and deleteButton to the fileItem div
        fileItem.appendChild(fileDataContainer);
        fileItem.appendChild(deleteButton);

        // Append fileItem div to the file preview display area
        filePreview.appendChild(fileItem);
    })
    logFiles(); //FOR TESTING: REMOVE LATER
})

// function to remove a file from the manual file list at a given index
function removeFile(index){
    fileList.splice(index,1); // at the given index, remove element
    updateFileInput(); // update the file list array
}

// function to update the file list
function updateFileInput(){
    // create a new dataTransfer object to allow manipulation of file input list
    const dataTransfer = new DataTransfer();

    // add all remaining fileList elements to dataTransfer object
    fileList.forEach(file => dataTransfer.items.add(file));

    // replace the current file input list with the new updated dataTransfer object
    fileInput.files = dataTransfer.files; 

    // trigger the 'change' event to refresh the display
    fileInput.dispatchEvent(new Event('change'));
}

// function to format the file size to readable sizes
function formatFileSize(bytes){
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if(bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)),10);
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

