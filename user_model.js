// users.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  playlists: [{
    name: {
      type: String,
      required: true
    },
    songs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song'
    }]
  }]
});

const User = mongoose.model('User', userSchema);

module.exports = User;