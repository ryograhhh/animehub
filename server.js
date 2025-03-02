// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    // Create specific directories for different file types
    let specificDir;
    if (file.mimetype.startsWith('image/')) {
      specificDir = path.join(uploadDir, 'images');
    } else if (file.mimetype.startsWith('video/')) {
      specificDir = path.join(uploadDir, 'videos');
    } else {
      specificDir = path.join(uploadDir, 'others');
    }
    
    // Create the specific directory if it doesn't exist
    if (!fs.existsSync(specificDir)) {
      fs.mkdirSync(specificDir, { recursive: true });
    }
    
    cb(null, specificDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

// Configure multer for file size limits - increased to 200MB
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images and videos only, specifically allowing MP4
    if (file.mimetype.startsWith('image/') || 
        file.mimetype.startsWith('video/') || 
        file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'watch.html'));
});

// Endpoint to handle image uploads
app.post('/api/upload/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Return the file URL
    const fileUrl = `/uploads/images/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint to handle video uploads with chunked upload support
app.post('/api/upload/video', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Extract episode number from filename (if possible)
    const fileName = req.file.originalname;
    let episodeNumber = null;
    
    const episodeMatch = fileName.match(/[Ee]pisode\s*(\d+)|[Ee]p\s*(\d+)|[Ee]\s*(\d+)|S\d+E(\d+)/);
    if (episodeMatch) {
      // Find the first capture group that's not undefined and is a number
      episodeNumber = episodeMatch.slice(1).find(match => match && !isNaN(match));
    }
    
    // Return the file URL and detected episode number
    const fileUrl = `/uploads/videos/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Video uploaded successfully',
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      episodeNumber: episodeNumber || null
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// API endpoint to get uploaded files list
app.get('/api/files', (req, res) => {
  try {
    const imagesDir = path.join(__dirname, 'uploads', 'images');
    const videosDir = path.join(__dirname, 'uploads', 'videos');
    
    let images = [];
    let videos = [];
    
    // Get images if directory exists
    if (fs.existsSync(imagesDir)) {
      images = fs.readdirSync(imagesDir).map(file => ({
        url: `/uploads/images/${file}`,
        name: file,
        type: 'image',
        size: fs.statSync(path.join(imagesDir, file)).size
      }));
    }
    
    // Get videos if directory exists
    if (fs.existsSync(videosDir)) {
      videos = fs.readdirSync(videosDir).map(file => ({
        url: `/uploads/videos/${file}`,
        name: file,
        type: 'video',
        size: fs.statSync(path.join(videosDir, file)).size
      }));
    }
    
    res.json({
      success: true,
      files: {
        images,
        videos
      }
    });
  } catch (error) {
    console.error('Error getting files:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Handle BigCommand embedded videos
app.get('/api/embed/info', (req, res) => {
  const { embedId } = req.query;
  
  if (!embedId) {
    return res.status(400).json({ success: false, message: 'No embed ID provided' });
  }
  
  // Since we can't actually fetch info from BigCommand's API,
  // we just return a basic response to confirm we received the request
  res.json({
    success: true,
    embedId: embedId,
    status: 'available'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong on the server'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export for Vercel
module.exports = app;
