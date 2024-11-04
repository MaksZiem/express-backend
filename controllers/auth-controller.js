const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs')
const HttpError = require('../models/http-error');
const User = require('../models/user');
const jwt = require('jsonwebtoken')

// const getUsers = async (req, res, next) => {
//   let users;
//   try {
//     users = await User.find({}, '-password');
//   } catch (err) {
//     const error = new HttpError(
//       'Fetching users failed, please try again later.',
//       500
//     );
//     return next(error);
//   }
//   res.json({ users: users.map(user => user.toObject({ getters: true })) });
// };

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  const { name, email, password, role, surname, pesel } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      'Signing up failed, please try again later.',
      500
    );
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      'User exists already, please login instead.',
      422
    );
    return next(error);
  }

  let hashPass
  try {
    hashPass = await bcrypt.hash(password, 12)
  } catch (err) {
    const error = new HttpError('Could not create user with this password', 500)
    return next(error)
  }


  const createdUser = new User({
    name,
    surname,
    email,
    pesel,
    password: hashPass,
    role,
    image: req.file.path,
    dishCart: { items: [] },
    ingredientCart: { items: [] },
  });

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError(
      'Signing up failed, please try again later.',
      500
    );
    return next(error);
  }

  let token;
  try {
    token = jwt.sign({userId: createdUser.id, email: createdUser.email}, 'TOKEN_KEY', {expiresIn: '1h'})
  } catch (err) {
    const error = new HttpError(
        'Signing up failed, please try again later.',
        500
      );
      return next(error);
  }


  res.status(201).json({ user: createdUser.id, email: createdUser.email, token: token, userRole: createdUser.role});
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError(
      'Loggin in failed, please try again later.',
      500
    );
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError(
      'Invalid credentials, could not log you in.',
      401
    );
    return next(error);
  }
  
  let isValidPass = false
  try {
    isValidPass = await bcrypt.compare(password, existingUser.password)
  } catch (err) {
    const error = new HttpError('Could not log you in, check login inputs', 500)
    return next(error)
  }

  if (!isValidPass) {
    const error = new HttpError(
        'Invalid credentials, could not log you in.',
        401
      );
      return next(error);
  }

  let token;
  try {
    token = jwt.sign({userId: existingUser.id, email: existingUser.email}, 'TOKEN_KEY', {expiresIn: '1h'})
  } catch (err) {
    const error = new HttpError(
        'Logging up failed, please try again later.',
        500
      );
      return next(error);
  }

  console.log(existingUser.email)

  req.user = existingUser;
  console.log("req user: " + req.userData)
  


  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
    userRole: existingUser.role
  });
};

const updateUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  const userId = req.params.userId; // Pobranie ID użytkownika z parametru URL
  const { name, surname, email, pesel } = req.body; // Pobranie zaktualizowanych danych użytkownika z ciała zapytania

  let user;
  try {
    user = await User.findById(userId);
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update user.',
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError(
      'Could not find user for this id.',
      404
    );
    return next(error);
  }

  user.name = name;
  user.surname = surname;
  user.email = email;
  user.pesel = pesel;

  try {
    await user.save();
  } catch (err) {
    const error = new HttpError(
      'Something went wrong, could not update user.',
      500
    );
    return next(error);
  }

  res.status(200).json({ user: user.toObject({ getters: true }) });
};

const getUserById = async (req, res, next) => {
  const userId = req.params.userId; // Pobranie ID użytkownika z parametru URL

  let user;
  try {
    user = await User.findById(userId, '-password'); // Znalezienie użytkownika bez pola `password`
  } catch (err) {
    const error = new HttpError(
      'Fetching user data failed, please try again later.',
      500
    );
    return next(error);
  }

  if (!user) {
    const error = new HttpError(
      'Could not find a user for the provided id.',
      404
    );
    return next(error);
  }

  res.json({ user: user.toObject({ getters: true }) }); // Zwrócenie użytkownika jako obiekt z getterami
};

exports.getUserById = getUserById
// exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
exports.updateUser = updateUser;
