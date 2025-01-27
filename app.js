const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const fetch = require('node-fetch');
const app = express();
const port = 3000;
const {
  generatePresignedURL,
  uploadFile,
  s3,
  uploadFileMultiPart
} = require('./cloud');
const {
  zipper,
  randomKey
} = require('./utility');

// Serve static files from the "mainpage" directory and "assets" folder
app.use(express.static(path.join(__dirname, 'mainpage')));
app.use('/assets',express.static(path.join(__dirname,'assets')));

// Middleware
app.use(express.json());

// mount router to app
app.use(router);

// Serve index.html on the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'mainpage', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});


// Endpoint that takes get requests to create presigned urls for upload to s3. Returns json response with presigned url.
 app.get('/generate-presigned-url', async (req,res) => { // defines get request to endpoint
  const{ fileName, fileType } = req.query; // retrieves query parameters from request URL

  try{
    const url = await generatePresignedURL(fileName, fileType); //call function to create a presigned url
    res.status(200).json({ url }); //if successful, respond with 200 status and a json response containing the url
  }catch (error){ // error handling
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Error generating presigned URL' })
  };
});



// Custom storage to handle files as streams
const storage = multer.diskStorage({
    // directory where uploaded files will be stored.
    destination: (req, file, cb) => { // req is request object, file is file object, cb is callback to signal completion
        const uploadDir = path.join(__dirname, 'uploads'); //path of uploads folder
        if(!fs.existsSync(uploadDir)){ //check if uploads folder exists, if not create one
            fs.mkdirSync(uploadDir, {recursive: true});
        }
        cb(null, uploadDir); //callback
    },
});

// Initalize multer with custom storage
const upload = multer({storage});

// http post endppint, expects a single file.
app.post('/upload', upload.array('files'), async (req,res) => {

    // retrieve uploaded file's metadata
    const uploadedFiles = req.files;

    // check if the file uploaded or not, send error if not.
    if(!uploadedFiles || uploadedFiles.length === 0){
        return res.status(400).send('No file uploaded');
    }

    try{
        for(const file of uploadedFiles){  
            // create file path to uploads folder for temp storage and define metadata values
            const filePath = path.join(__dirname, 'uploads', file.filename);
            const fileName = `${file.originalname}`; //-${randomKey()}`
            const fileType = file.mimetype;

            // creates a readable stream for the uploaded file using its saved location.
            const readStream = fs.createReadStream(filePath);

            // upload file to s3
            await uploadFileMultiPart(readStream, fileName, fileType);

            // delete the file temporarily stored in disk
            fs.unlink(filePath, (err) =>{
                if(err) console.error(`Error deleting file ${fileName} from disk.`, err);
                else console.log(`File ${fileName} deleted from disk after upload.`);
            });
        }
        // success
        res.send('File uploaded and processed successfully.');
  } catch(error){ //error handling
        console.error('Error uploading file: ', error);
        res.status(500).send('Error processing file.');
  }
});

// route to initiate multipart upload
router.post('/initiate-multipart-upload', async (req,res) =>{

    // retrieve request body
    const{ fileName, fileType, fileSize } = req.body;

    console.log(`Received request to initiate multipart upload for file: ${fileName}`);

    if (!fileName || !fileType || !fileSize) {
        console.error('Missing fileName, fileType, or fileSize in request body.');
        return res.status(400).json({ error: 'Missing fileName, fileType, or fileSize' });
    }

    try{
        // populate parameters for s3
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            ContentType: fileType,
        };

        // initiate multipart upload
        const {UploadId} = await s3.createMultipartUpload(params).promise();

        // Find amount of parts
        const partCount = Math.ceil(req.body.fileSize / (5*1024*1024));
        console.log('Part count:', partCount);

        // Array to contain presigned url for each part upload
        const presignedUrls = [];

        // loop through all parts of the upload and generate presigned urls
        for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    try {
        const url = await s3.getSignedUrlPromise('uploadPart', {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            UploadId,
            PartNumber: partNumber,
        });
        presignedUrls.push(url);
        console.log(`Generated presigned URL for part ${partNumber}`);
    } catch (err) {
        console.error(`Error generating presigned URL for part ${partNumber}:`, err);
        console.error('AWS Error Response:', err.message);
    }
}

        // response
        res.json({uploadId: UploadId, parts: presignedUrls});

    }catch(error){ //error handling
        console.error('Error initiating multipart upload:', error);
        res.status(500).json({ error: 'Failed to initiate multipart upload' });
    };
})

// route to complete multipart upload
router.post('/complete-multipart-upload', async (req,res) => {

    // retrieve request body
    const { uploadId, fileName, parts } = req.body;

    if(!uploadId || !fileName || !parts || !Array.isArray(parts)){
        return res.status(400).json({ error: 'Invalid request payload' });
    }

    try{
        const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.map(({ PartNumber, ETag }) => ({
                    PartNumber,
                    ETag,
                })),
            },
        };

        const result = await s3.completeMultipartUpload(params).promise();
        res.json({ message: 'Upload complete', location: result.location });

    }catch(error){
        console.error('Error completing multipart upload:', error);
        res.status(500).json({ error: 'Failed to complete multipart upload' });
    }

})