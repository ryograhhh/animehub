// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Use temporary directory for Vercel environment
const getTempUploadDir = () => {
  // Use the OS temp directory since /var/task is read-only on Vercel
  const baseDir = os.tmpdir();
  const uploadDir = path.join(baseDir, 'senpai-anime-uploads');
  
  // Create main upload directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`Created temp upload directory: ${uploadDir}`);
    } catch (err) {
      console.error(`Failed to create temp upload directory: ${err.message}`);
    }
  }
  
  // Create subdirectories
  const imageDirPath = path.join(uploadDir, 'images');
  const videoDirPath = path.join(uploadDir, 'videos');
  
  if (!fs.existsSync(imageDirPath)) {
    try {
      fs.mkdirSync(imageDirPath, { recursive: true });
    } catch (err) {
      console.error(`Failed to create images directory: ${err.message}`);
    }
  }
  
  if (!fs.existsSync(videoDirPath)) {
    try {
      fs.mkdirSync(videoDirPath, { recursive: true });
    } catch (err) {
      console.error(`Failed to create videos directory: ${err.message}`);
    }
  }
  
  return uploadDir;
};

// Get the temporary upload directory
const UPLOAD_DIR = getTempUploadDir();

// Configure multer for file storage in temp directory
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let specificDir;
    
    if (file.mimetype.startsWith('image/')) {
      specificDir = path.join(UPLOAD_DIR, 'images');
    } else if (file.mimetype.startsWith('video/') || file.mimetype === 'video/mp4') {
      specificDir = path.join(UPLOAD_DIR, 'videos');
    } else {
      specificDir = path.join(UPLOAD_DIR, 'others');
      if (!fs.existsSync(specificDir)) {
        try {
          fs.mkdirSync(specificDir, { recursive: true });
        } catch (err) {
          console.error(`Failed to create others directory: ${err.message}`);
          return cb(new Error(`Failed to create directory: ${err.message}`));
        }
      }
    }
    
    cb(null, specificDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const nameWithoutExt = path.basename(originalName, path.extname(originalName));
    const ext = path.extname(originalName);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  }
});

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/') || 
        file.mimetype.startsWith('video/') || 
        file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
}).single('file');

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use('/temp-uploads', express.static(UPLOAD_DIR));
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

// Universal file upload endpoint
app.post('/api/upload/:type', (req, res) => {
  // Log directory status
  console.log(`Upload directory: ${UPLOAD_DIR}`);
  console.log(`Images directory: ${path.join(UPLOAD_DIR, 'images')}`);
  console.log(`Videos directory: ${path.join(UPLOAD_DIR, 'videos')}`);
  
  // Process the upload
  upload(req, res, function(err) {
    if (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ 
        success: false, 
        message: err.message || 'Error uploading file' 
      });
    }
    
    // If no file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    const fileType = req.params.type;
    let episodeNumber = null;
    
    // Extract episode number from filename for videos
    if (fileType === 'video') {
      const fileName = req.file.originalname;
      const episodeMatch = fileName.match(/[Ee]pisode\s*(\d+)|[Ee]p\s*(\d+)|[Ee]\s*(\d+)|S\d+E(\d+)/);
      if (episodeMatch) {
        episodeNumber = episodeMatch.slice(1).find(match => match && !isNaN(match));
      }
    }
    
    // Return the file URL (relative to the server root)
    const fileUrl = `/temp-uploads/${fileType}s/${req.file.filename}`;
    
    res.json({
      success: true,
      message: `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} uploaded successfully`,
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      episodeNumber: episodeNumber
    });
  });
});

// Backward compatibility routes
app.post('/api/upload/image', (req, res) => {
  req.params.type = 'image';
  
  // Process the upload
  upload(req, res, function(err) {
    if (err) {
      console.error("Image upload error:", err);
      return res.status(500).json({ 
        success: false, 
        message: err.message || 'Error uploading image' 
      });
    }
    
    // If no file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No image file uploaded' 
      });
    }
    
    // Return the file URL (relative to the server root)
    const fileUrl = `/temp-uploads/images/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  });
});

app.post('/api/upload/video', (req, res) => {
  req.params.type = 'video';
  
  // Process the upload
  upload(req, res, function(err) {
    if (err) {
      console.error("Video upload error:", err);
      return res.status(500).json({ 
        success: false, 
        message: err.message || 'Error uploading video' 
      });
    }
    
    // If no file was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No video file uploaded' 
      });
    }
    
    // Extract episode number from filename
    const fileName = req.file.originalname;
    let episodeNumber = null;
    
    const episodeMatch = fileName.match(/[Ee]pisode\s*(\d+)|[Ee]p\s*(\d+)|[Ee]\s*(\d+)|S\d+E(\d+)/);
    if (episodeMatch) {
      episodeNumber = episodeMatch.slice(1).find(match => match && !isNaN(match));
    }
    
    // Return the file URL (relative to the server root)
    const fileUrl = `/temp-uploads/videos/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Video uploaded successfully',
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      episodeNumber: episodeNumber || null
    });
  });
});

// API endpoint to get uploaded files list
app.get('/api/files', (req, res) => {
  try {
    const imagesDir = path.join(UPLOAD_DIR, 'images');
    const videosDir = path.join(UPLOAD_DIR, 'videos');
    
    let images = [];
    let videos = [];
    
    // Get images if directory exists
    if (fs.existsSync(imagesDir)) {
      images = fs.readdirSync(imagesDir).map(file => ({
        url: `/temp-uploads/images/${file}`,
        name: file,
        type: 'image',
        size: fs.statSync(path.join(imagesDir, file)).size
      }));
    }
    
    // Get videos if directory exists
    if (fs.existsSync(videosDir)) {
      videos = fs.readdirSync(videosDir).map(file => ({
        url: `/temp-uploads/videos/${file}`,
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
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong on the server'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});

// Export for Vercel
module.exports = app;
