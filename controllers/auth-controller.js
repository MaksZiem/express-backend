const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs')
const HttpError = require('../models/http-error');
const User = require('../models/user');
const jwt = require('jsonwebtoken')

exports.getUsers = async (req, res, next) => {
  const page = parseInt(req.query.page) || 1; 
  const limit = parseInt(req.query.limit) || 10; 

  let users;
  let totalUsers;

  try {
    totalUsers = await User.countDocuments(); 
    users = await User.find({}, '-password')
      .skip((page - 1) * limit)
      .limit(limit);
  } catch (err) {
    const error = new HttpError(
      'Fetching users failed, please try again later.',
      500
    );
    return next(error);
  }

  res.json({
    users: users.map(user => user.toObject({ getters: true })),
    total: totalUsers,
    page: page,
    pages: Math.ceil(totalUsers / limit) 
  });
};

exports.signup = async (req, res, next) => {
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

exports.login = async (req, res, next) => {
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

exports.updateUser = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError('Invalid inputs passed, please check your data.', 422)
    );
  }

  const userId = req.params.userId; 
  const { name, surname, email, pesel } = req.body; 

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

  if (req.file && req.file.path) {
    user.image = req.file.path;
  }

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

exports.getUserById = async (req, res, next) => {
  const userId = req.params.userId; 

  let user;
  try {
    user = await User.findById(userId, '-password'); 
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

  res.json({ user: user.toObject({ getters: true }) }); 
};

