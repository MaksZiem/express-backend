// const jwt = require('jsonwebtoken');

// const HttpError = require('../models/http-error');
// const User = require('../models/user'); // Twój model użytkownika
// module.exports = async (req, res, next) => {
//   if (req.method === 'OPTIONS') {
//     return next();
//   }
//   try {
//     const token = req.headers.authorization.split(' ')[1]; // Authorization: 'Bearer TOKEN'
//     if (!token) {
//       throw new Error('Authentication failed!');
//     }
//     const decodedToken = jwt.verify(token, 'TOKEN_KEY');
//     req.userData = { userId: decodedToken.userId };
    

//     next();
//   } catch (err) {
//     const error = new HttpError('Authentication failed!', 401);
//     console.log(err)
//     return next(error);
//   }
// };

const jwt = require('jsonwebtoken');
const HttpError = require('../models/http-error');
const User = require('../models/user'); // Model użytkownika

module.exports = async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  try {
    const token = req.headers.authorization.split(' ')[1]; // Authorization: 'Bearer TOKEN'
    if (!token) {
      throw new Error('Authentication failed!');
    }
    
    const decodedToken = jwt.verify(token, 'TOKEN_KEY');
    req.userData = { userId: decodedToken.userId };

    // Załaduj użytkownika z bazy danych
    const user = await User.findById(req.userData.userId);
    if (!user) {
      throw new Error('User not found!');
    }
    
    req.user = user; // Ustaw użytkownika w req
    next();
  } catch (err) {
    const error = new HttpError('Authentication failed!', 401);
    console.log(err);
    return next(error);
  }
};
