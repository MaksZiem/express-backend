const express = require('express');

const authController = require('../controllers/auth-controller');

const router = express.Router();

const fileUpload = require('../middleware/file-upload')

// router.get('/', authController.getUsers);

router.get('/:userId', authController.getUserById)

router.patch('/:userId', authController.updateUser)

router.post('/signup', fileUpload.single('image'), authController.signup );

router.post('/login', authController.login);



module.exports = router;
