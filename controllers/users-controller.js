const HttpError = require('../models/http-error');
const User = require('../models/user')
const { validationResult } = require('express-validator')
const mongoose = require('mongoose');

exports.getUsers = async (req, res, next) => {
    let users;
    try {
      //wyszukuej userow ale nie zwraca hasel
      users = await User.find({}, '-password')
    } catch (err) {
      const error = new HttpError(
        'Fetching users failed', 500
      )
      return next(error)
    }
    res.json({users: users.map(user => user.toObject({getters: true}))})
};

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return next(new HttpError('Invalid inputs passed, please check your data.', 422))
    }
  const { name, email, password, places } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email })
  } catch (err) {
    const error = new HttpError(
      'Signing up failed, please try again later', 500
    )
    return next(error)
  }

  if(existingUser) {
    const error = new HttpError(
      'User already exists, please login instead'
    )
    return next(error)
  }


  const createdUser = new User({
    name,
    email,
    password,
    places
  })
  
  try {
    await createdUser.save();
} catch (err) {
    const error = new HttpError(
        'signup failed, please try again.',
        500
    );
    return next(error);
}
  
  res.status(201).json({ user: createdUser.toObject({getters: true}) });
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email })
  } catch (err) {
    const error = new HttpError(
      'Login up failed, please try again later', 500
    )
    return next(error)
  }

  if(!existingUser || existingUser.password !== password) {
    const error = new HttpError(
      'invalid credentials, could not log in', 401
    )
    return next(error)
  }

  res.json({ message: 'Logged in!' });
};


exports.getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.params.userId;

    // Sprawdzanie poprawności userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID." });
    }

    // Pobieranie danych użytkownika
    const user = await User.findById(userId);

    // Sprawdzenie, czy użytkownik istnieje
    if (!user) {
        return res.status(404).json({ message: "User not found." });
    }

    // Zwracanie danych użytkownika
    res.status(200).json({
        user
    });
} catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error.", error: err.message });
}
};

