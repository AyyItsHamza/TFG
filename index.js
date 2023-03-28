require('dotenv').config()
const express = require("express");
const mongoose = require("mongoose");
const userModel = require("./user_model");
const songs_model = require("./songs_model");
const playlist_model = require("./playlist_model");

const path = require("path");
const jwt = require('jsonwebtoken');
const bcrypt = require("bcryptjs");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { response } = require('express');

const app = express();
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
                    return response.status(200).json({msg: "Login successful", jtw : token});
                }
            } else {
                return response.status(400).json({msg:"Wrong password"});
            }
        }
    }
});

app.post("/melomuse/api/v1/register", async (request, response) => {
    const userr = request.body.username;
    var pass = request.body.password;
    const nombre = request.body.nombre;
    
    var hashPassword = await bcrypt.hash(pass, 10);
    pass = hashPassword;

  if(userr === "" || pass === "" || nombre === ""){
      return response.status(406).json({msg:"Please fill in all fields"});
  } else {  // Check if username already exists
      const user = await userModel.findOne({username: userr});
      if(user === null){
            const user = new userModel({
                nombre: nombre,
                username: userr,
                password: hashPassword
            });
          user.save();
          return response.status(200).json({msg:"User created successfully"});
      } else {
          return response.status(400).json({msg:"Username already exists"});
      }
  }
});

app.post("/melomuse/api/v1/add_song", verifyToken, async (request, response) => {
  var song = new songs_model({
      username: request.cookies.username,
      title : request.body.song_title,
      artist : request.body.song_artist,
      filepath : request.body.filepath,
  });

  if(song.title === "" || song.artist === "" || song.filepath === "" ){
      return response.status(406).json({msg: "Please fill atleast the text field"});
  } else { 
      song.save(); 
      return response.status(200).json({msg: "Song Uploaded successfully"});
  } 
});


app.get('/melomuse/api/v1/songs',async, (request, response) => {
    try{
        const songs = await songs_model.find({});
        return response.json(songs).status(200);
    }catch{
        res.status(500).json({message : "server error"})
    }
});

app.get('/melomuse/api/v1/songs/:id',verifyToken, async (req, res) => {
    try {
      const song = await songs_model.findById(req.params.id);
      if (!song) {
        return res.status(404).json({ message: 'Song not found' });
      }
      res.json(song);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
});

app.get('/melomuse/api/v1/playlists',verifyToken, async (req, res) => {
    try {
      const playlists = await playlist_model.find({});
      res.json(playlists);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
});

router.get('/melomuse/api/v1/playlists/:id', verifyToken, async (req, res) => {
    try {
      const playlist = await playlist_model.findById(req.params.id);
      if (!playlist) {
        return res.status(404).json({ message: 'Playlist not found' });
      }
      res.json(playlist);
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

router.post('/melomuse/api/v1/logout', async (req, res) => {
    try {
      req.session.destroy();
      res.json({ message: 'User logged out' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
});

router.get('/melomuse/api/v1/user/:id', async (req, res) => {
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

router.put('/api/v1/user/update/:id', async (req, res) => {
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
    return response.status(200).sendFile(path.resolve(__dirname,'../frontend/login.html'));
    console.log("hola");
});