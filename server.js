const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Create required directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const videosDir = path.join(uploadsDir, 'videos');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine which directory to use based on file type
    let specificDir;
    if (file.mimetype.startsWith('image/')) {
      specificDir = imagesDir;
    } else if (file.mimetype.startsWith('video/') || file.mimetype === 'video/mp4') {
      specificDir = videosDir;
    } else {
      specificDir = path.join(uploadsDir, 'others');
      if (!fs.existsSync(specificDir)) {
        fs.mkdirSync(specificDir, { recursive: true });
      }
    }
    
    cb(null, specificDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename while preserving original extension and name
    const originalName = file.originalname;
    const nameWithoutExt = path.basename(originalName, path.extname(originalName));
    const ext = path.extname(originalName);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  }
});

// Configure multer for file size limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // Increased to 500MB limit
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
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

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
    
    // Return the file URL (relative to the server root)
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

// Endpoint to handle video uploads with improved error handling
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
    
    // Return the file URL (relative to the server root)
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
  console.log(`Uploads directory: ${uploadsDir}`);
});

// Export for Vercel
module.exports = app;
