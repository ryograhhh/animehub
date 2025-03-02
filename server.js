// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directories exist
const createDirectories = () => {
  const dirs = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads', 'images'),
    path.join(__dirname, 'uploads', 'videos'),
    path.join(__dirname, 'uploads', 'others')
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Directory created: ${dir}`);
      } catch (err) {
        console.error(`Failed to create directory: ${dir}`, err);
      }
    }
  });
};

// Create necessary directories
createDirectories();

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine which directory to use based on file type
    let specificDir;
    if (file.mimetype.startsWith('image/')) {
      specificDir = path.join(__dirname, 'uploads', 'images');
    } else if (file.mimetype.startsWith('video/') || file.mimetype === 'video/mp4') {
      specificDir = path.join(__dirname, 'uploads', 'videos');
    } else {
      specificDir = path.join(__dirname, 'uploads', 'others');
    }
    
    // Ensure directory exists
    if (!fs.existsSync(specificDir)) {
      try {
        fs.mkdirSync(specificDir, { recursive: true });
      } catch (err) {
        console.error(`Failed to create directory for upload: ${specificDir}`, err);
        return cb(new Error(`Failed to create directory for upload: ${err.message}`));
      }
    }
    
    cb(null, specificDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename while preserving original extension
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize filename
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
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept images and videos
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

// Universal file upload endpoint with better error handling
app.post('/api/upload/:type', (req, res) => {
  // Use a custom multer upload function with better error handling
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
        // Find the first capture group that's not undefined and is a number
        episodeNumber = episodeMatch.slice(1).find(match => match && !isNaN(match));
      }
    }
    
    // Return the file URL (relative to the server root)
    const fileUrl = `/uploads/${fileType}s/${req.file.filename}`;
    
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
  // Forward to the universal handler
  const uploadHandler = (req, res, next) => {
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
      const fileUrl = `/uploads/images/${req.file.filename}`;
      
      res.json({
        success: true,
        message: 'Image uploaded successfully',
        fileUrl: fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size
      });
    });
  };
  
  uploadHandler(req, res);
});

app.post('/api/upload/video', (req, res) => {
  req.params.type = 'video';
  // Forward to the universal handler
  const uploadHandler = (req, res, next) => {
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
    });
  };
  
  uploadHandler(req, res);
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
