const express = require('express');

const usersController = require('../controllers/users-controller');

const router = express.Router();

router.get('/', usersController.getUsers);

router.post('/signup', usersController.signup);

router.post('/login', usersController.login);

router.post('/:userId', usersController.getCurrentUser)

module.exports = router;
