require('dotenv').config()
const cors = require('cors')
const express = require("express");
const mongoose = require("mongoose");
const userModel = require("./user_model");
const songs_model = require("./songs_model");
const fs = require('fs');
const multer = require('multer');

const email = process.env.email;
const password = process.env.password;

const path = require("path");
const jwt = require('jsonwebtoken');
const bcrypt = require("bcryptjs");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan ("dev"));
app.use(express.static('../frontend'))
app.use(cookieParser());

const server = app.listen(5000, () => {    
    console.log("Server is running at port 5000");
});

function verifyToken(req, res, next) {
    const token = req.cookies.access_token;
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    jwt.verify(token, process.env.SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ msg: "Invalid token" });
        }
        req.user = decoded;
        next();
    });
}

// Configurar multer para manejar la subida de archivos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, './public/songs');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

mongoose.connect(`mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_DB}.mongodb.net/?retryWrites=true&w=majority`),{
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
    autoindex: true
};

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error: "));
db.once("open", function () {
  console.log("Connected successfully");
});

app.post("/melomuse/api/v1/login", async (request, response) => {
    const userr = request.body.username;
    const pass = request.body.password;

    console.log(userr,pass)

    if(userr === "" || pass === ""){
        response.status(406).json({msg:"Please fill in all fields"});
    }  else { 
        const user = await userModel.findOne({username: userr});
        if(user === null){
            return response.status(400).json({ msg:"User not found"});
        } else {
            if(bcrypt.compareSync(pass, user.password)){
                const token = request.cookies.access_token;
                if(token){
                    const decoded = jwt.verify(token, process.env.SECRET);
                    if(decoded.username === user.username){
                        return response.status(400).json({ msg:"You are already logged in"});
                    }
                } else {
                    const token = jwt.sign({username: user.username, id: user._id}, process.env.SECRET, {expiresIn: "1h"});
                    user.token = token;
                    response.cookie ("access_token", token,  {maxAge: 3600000, httpOnly: true})
                    response.cookie ("username", user.username,  {maxAge: 3600000, httpOnly: true})
                    response.cookie ("userId", user._id, {maxAge: 3600000, httpOnly: true})
                    return response.status(200).json({msg: "Login successful", jtw : token, username: user.username, userId : user._id});
                }
            } else {
                return response.status(400).json({msg:"Wrong password"});
            }
        }
    }
});

app.post("/melomuse/api/v1/register", async (request, response) => {
    const userr = request.body.username;
    const pass = request.body.password;
    const nombre = request.body.name;
  
    const hashPassword = await bcrypt.hashSync(pass, 10);

  if(userr === "" || pass === "" || nombre === ""){
      return response.status(406).json({msg:"Please fill in all fields"});
  } else {  // Check if username already exists
      const user = await userModel.findOne({username: userr});
      if(user === null){
            const user = new userModel({
                name: nombre,
                username: userr,
                password: hashPassword,
                playlists: [{name : "default Playlist"}]
            });
          user.save();
          return response.status(200).json({msg:"User created successfully"});
      } else {
          return response.status(400).json({msg:"Username already exists"});
      }
  }
});

app.post('/melomuse/api/v1/add_song', upload.single('file_path'), async (req, res) => {
  try {
    const { title, artist } = req.body;
    const filePath = req.file.path;
    
    // Verificar que la propiedad "file_path" está presente en "req.file"
    if (!filePath) {
      return res.status(400).json({ message: 'La propiedad "file_path" no se encuentra en el objeto "req.file"' });
    }

    const newSong = new songs_model({
      title,
      artist,
      file_path: filePath
    });
    const savedSong = await newSong.save();
    res.json(savedSong);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


app.get('/melomuse/api/v1/songs', async (request, response) => {
    try{
        const songs = await songs_model.find({});
        return response.json(songs).status(200);
    }catch{
        res.status(500).json({message : "server error"})
    }
});

app.get('/melomuse/api/v1/songs/:songId/file', async (request, response) => {
  try {
    const song = await songs_model.findById(request.params.songId);
    if (!song) {
      return response.status(404).json({ message: "Song not found" });
    }
    if (!song.file_path) {
      return response.status(400).json({ message: "Audio URL not found" });
    }
    const filePath = path.join(__dirname, song.file_path);

    return response.sendFile(filePath);

  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Server error" });
  }
});

app.get('/melomuse/api/v1/user/:userId/playlists', async (req, res) => {
  const userId = req.params.userId;

  try {
    // Busca el usuario en MongoDB por su ID
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtiene los _id y nombres de las playlists del usuario
    const playlists = user.playlists.map(playlist => {
      return {
        _id: playlist._id,
        name: playlist.name
      };
    });
    res.json(playlists);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

app.put('/melomuse/api/v1/playlists/:id/songs/:songId', async (req, res) => {
  const playlistId = req.params.id;
  const songId = req.params.songId;

  try {
    const playlist = await userModel.findOneAndUpdate(
      { 'playlists._id': playlistId, 'playlists.songs': { $ne: songId } },
      { $addToSet: { 'playlists.$.songs': songId } }
    );
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found or song already in playlist' });
    }
    res.json({ message: 'Song added to playlist' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/v1/search', async (req, res) => {
    try {
      const { search } = req.query;
      const songs = await songs_model.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { artist: { $regex: search, $options: 'i' } }
        ]
      });
      res.json(songs);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/melomuse/api/v1/delete/playlist/:id', async (req, res) => {
    try {
      const playlist = await playlist_model.findById(req.params.id);
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }
      await playlist.remove();
      res.json({ message: 'Playlist deleted' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
});

app.post('/melomuse/api/v1/logout', async (req, res) => {
    try {
      req.session.destroy();
      res.json({ message: 'User logged out' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
});

app.get('/melomuse/api/v1/user/:id',  async (req, res) => {
    try {
      const user = await userModel.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });

app.put('/api/v1/user/update/:id', async (req, res) => {
    try {
      const user = await userModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
});

app.get('/',(request, response) =>{
    //return response.status(200).sendFile(path.resolve(__dirname,'../frontend/login.html'));
    return response.status(200).json({message: "MELOMUSE"})
    console.log("hola");
});