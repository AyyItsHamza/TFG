const express = require('express')
const mysql = require('mysql')
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const jwt = require('jsonwebtoken');
const User = require("./user_info_model")
const app = express()

app.use(express.json());
app.use(cookieParser());

const port = 3000

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

const con = mysql.createConnection({
    host: process.env.Server,
    user: process.env.Username,
    password:  process.env.Password,
    database:  process.env.Name

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


app.get('/', (req, res) => {
    con.connect(function(err) {
        if (err) throw err;
        con.query("SELECT * FROM songs", function (err, result) {
          if (err) throw err;
          console.log(result);
        });
    });
});

app.post("/api/v1/login", async (request, response) => {
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

app.post("/api/v1/register", async (request, response) => {
    const name = request.body.username;
    const lastname = request.body.lastname
    var pass = request.body.password;
   
    var hashPassword = await bcrypt.hash(pass, 10);
    pass = hashPassword;

    if(name === "" || pass === "" || lastname === ""){
        return response.status(406).json({msg:"Please fill in all fields"});
    } else {  // Check if username already exists
            
    } 
});