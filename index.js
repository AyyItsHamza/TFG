require('dotenv').config()
const express = require("express");
const mongoose = require("mongoose");
const userModel = require("./user_model");
const songs_model = require("./songs_model");
const path = require("path");
const jwt = require('jsonwebtoken');
const bcrypt = require("bcryptjs");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

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

app.post("/api/blitzchat/auth/login", async (request, response) => {
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

app.post("/api/blitzchat/auth/register", async (request, response) => {
    const userr = request.body.username;
    var pass = request.body.password;
    const nombre = request.body.nombre;

    console.log(userr, pass, nombre);

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

app.post("/api/blitzchat/add_post", verifyToken, async (request, response) => {
  var posts = new postModel({
      username: request.cookies.username,
      text : request.body.text,
      imagen : request.body.imagen,
      audio : request.body.audio,
      video : request.body.video
  });

  if(posts.text === "" ){
      return response.status(406).json({msg: "Please fill atleast the text field"});
  } else { 
      posts.save(); 
      return response.status(200).json({msg: "Post created successfully"});
  } 
});

app.get("/api/blitzchat/get_post_id" , verifyToken, async (request, response) => {
    const post = new postModel({
        username: request.cookies.username,
        text : request.body.text,
        imagen : request.body.imagen,
        audio : request.body.audio,
        video : request.body.video
    });
    const postid = await postModel.findOne({_id: post});
    return response.status(200).json({msg: postid});
});

app.get("/api/blitzchat/get_posts:username", verifyToken, async (request, response) => {
    const username = request.body.username;
    if (username === "") {
        return response.status(406).json({msg: "Please fill in all fields"});
    } else {
            try {
                const posts = await postModel.find({username: username});
                if (posts.length === 0) {
                    return response.status(400).json({msg: "No posts found for this user"});
                } else {
                    return response.status(200).json({msg: posts});
                }
            }catch (error) {
                return response.status(400).json({msg: "Error"});
            }   
        }
});

app.get("/api/blitzchat/get_last_ten_posts:username", verifyToken, async (request, response) => {
    const username = request.body.username;
    if (username === "") {
        return response.status(406).json({msg: "Please fill in all fields"});
    } else {
        try {
            const posts = await postModel.find({username: username}).sort({_id: -1}).limit(10);
            if (posts.length === 0) {
                return response.status(400).json({msg: "No posts found for this user"});
            } else {
                return response.status(200).json({msg: posts});
            }
        } catch (error) {
            return response.status(400).json({msg: "Error"});
        }
    }
});

app.put("/api/blitzchat/update_post:id", verifyToken, async (request, response) => {
  const id = request.body.id;
  const text = request.body.text;
  const imagen = request.body.imagen;
  const audio = request.body.audio;
  const video = request.body.video;
  
  if(id === ""){
      return response.status(406).json({msg: "please enter id of the post"});
  } else {
      const post = await postModel.findById(id);
      if(post === null){
          return response.status(400).json({msg: "Post not found"});
      } else {
          post.text = text;
          post.imagen = imagen;
          post.audio = audio;
          post.video = video;
          post.save();
          return response.status(200).json({msg: "Post updated successfully"});
      }
  }
});

app.put("/api/blitzchat/update/user",verifyToken,  async (request, response) => {
    const nombre = request.body.nombre;
    const username = request.cookies.username;
    var password = request.body.password;
    const hashPassword = await bcrypt.hash(password, 10);

    if (nombre === "" || password === "") {
        return response.status(406).json({msg: "Please fill in all fields"});
    }
    else {
        const user = await userModel.find({username: username});
        if(user === null){
            return response.status(400).json({msg: "User not found"});
        }
        else { 
            if (username === request.cookies.username){
                const newuser = new userModel({
                    nombre: nombre,
                    username: username,
                    password: hashPassword
                });
                newuser.save();
                return response.status(200).json({msg: "User updated successfully"});
            }   else {
                return response.status(400).json({msg: "You are not authorized to update this user"});
            }
        }
    }
});

app.delete("/api/blitzchat/delete_post:id", verifyToken, async (request, response) => {
  const id = request.body.id;
  if(id === ""){
      return response.status(406).json({msg: "please enter id of the post"});
  } else {
    const post = await postModel.findById(id);
    post.remove();
    return response.status(200).json({msg: "Post deleted successfully"});
  }
});

app.get('/',(request, response) =>{
    return response.status(200).sendFile(path.resolve(__dirname,'../frontend/login.html'));
    console.log("hola");
});

app.get("/api/blitzchat/posts",verifyToken, async (request, response) => {
  const posts = await postModel.find({});
  return response.json(posts);
});


