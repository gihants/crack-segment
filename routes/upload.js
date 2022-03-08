if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
}

const {
  Aborter,
  BlobURL,
  BlockBlobURL,
  ContainerURL,
  ServiceURL,
  StorageURL,
  SharedKeyCredential,
  uploadStreamToBlockBlob
} = require('@azure/storage-blob');

var apiBaseUrl = 'https://crack-segmentation-api.azurewebsites.net/api/segment?code=DR83soNiEYBZUWbNdX8ieRKowHnUyhSz7XPAfD4ECR9DxVzsoDsgYg=='

const express = require('express');
const router = express.Router();
const multer = require('multer');
const inMemoryStorage = multer.memoryStorage();
const uploadStrategy = multer({ storage: inMemoryStorage }).single('image');
const getStream = require('into-stream');
const containerName = 'images';
const ONE_MEGABYTE = 1024 * 1024;
const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxBuffers: 20 };
const ONE_MINUTE = 60 * 1000;

const sharedKeyCredential = new SharedKeyCredential(
  process.env.AZURE_STORAGE_ACCOUNT_NAME,
  process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY);
const pipeline = StorageURL.newPipeline(sharedKeyCredential);
const serviceURL = new ServiceURL(
  `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
  pipeline
);

const getBlobName = originalName => {
  // Use a random number to generate a unique file name, 
  // removing "0." from the start of the string.
  const identifier = Math.random().toString().replace(/0\./, ''); 
  return `${identifier}-${originalName}`;
};

router.post('/', uploadStrategy, async (req, res) => {

  const aborter = Aborter.timeout(30 * ONE_MINUTE);
  const blobName = getBlobName(req.file.originalname);
  const stream = getStream(req.file.buffer);
  const containerURL = ContainerURL.fromServiceURL(serviceURL, containerName);
  const blockBlobURL = BlockBlobURL.fromContainerURL(containerURL, blobName);


  var image_src;
  var original_image_scr;
  try {

    await uploadStreamToBlockBlob(aborter, stream,
      blockBlobURL, uploadOptions.bufferSize, uploadOptions.maxBuffers,
      { blobHTTPHeaders: { blobContentType: "image/jpeg" } });

    original_image_scr = "https://"+ process.env.AZURE_STORAGE_ACCOUNT_NAME +".blob.core.windows.net/" + containerName +"/" + blobName;
    await fetch( apiBaseUrl + "&img=https://"+ process.env.AZURE_STORAGE_ACCOUNT_NAME +".blob.core.windows.net/" + containerName +"/" + blobName)
    .then( response => response.json() )
    .then( response => {
        console.log(response.prediction)
        image_src = 'data:image;base64,' + response.prediction;
    } );


    

    res.render('success', { img_src: image_src, original_img_src:  original_image_scr});   


  } catch (err) {

    res.render('error', { message: err.message });

  }
});

module.exports = router;