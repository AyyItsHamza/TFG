const mysql = require('mysql')

const con = mysql.createConnection({
    host: process.env.Server,
    user: process.env.Username,
    password:  process.env.Password,
    database:  process.env.Name

});

module.exports = con ;