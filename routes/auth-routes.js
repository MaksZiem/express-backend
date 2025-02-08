const express = require('express');

const authController = require('../controllers/auth-controller');

const router = express.Router();

const fileUpload = require('../middleware/file-upload')

router.get('/users', authController.getUsers);

router.get('/:userId', authController.getUserById)

router.put('/:userId', fileUpload.single('image'), authController.updateUser)

router.post('/signup', fileUpload.single('image'), authController.signup );

router.post('/login', authController.login);



module.exports = router;
