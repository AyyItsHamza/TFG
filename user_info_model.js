const mysql = require('mysql')

const con = mysql.createConnection({
    host: process.env.Server,
    user: process.env.Username,
    password:  process.env.Password,
    database:  process.env.Name

});

const User = function(user){
    this.name = user.name;
    this.lastname = user.lastname;
    this.username = user.username;
    this.pass = user.pass;
}

User.create = (newUser, result) => {
    con.connect(function(err) {
        if (err) throw err;
        con.query('INSERT INTO user_info SET ?', newUser, (err,res) =>{
            if (err){
                console.log("error", err);
                result(err,null);
                return;
            }
        });
    });
};

User.finduser = (username, result) => {
    con.connect(function(err) {
        if (err) throw err;
        con.query('SELECT * FROM user_info WHERE username = ?', username, (err,res) =>{
            if (err){
                console.log("error", err);
                result(null,err);
            }
            if(res.length){
                console.log("found user:", res[0]);
                result(null, res[0]);
                return;
            }
            result({kind: "not found"}, null);
        });
    });
};

User.update = (id, user, result) => {
    con.connect(function(err) {
        if (err) throw err;
        con.query('UPDATE user_info SET name = ?, lastname = ? , password = ? WHERE id = ? ', [user.name, user.lastname, user.password, id], (err,res) =>{
            if (err){
                console.log("error", err);
                result(null,err);
            }
            if(res.length){
                console.log("found user:", res[0]);
                result(null, res[0]);
                return;
            }
            if(res.affectRows == 0){
                result({kind: "not found"}, null);
            }
        });
    });
};


module.exports = User;