const express = require('express');

const authController = require('../controllers/auth-controller');

const router = express.Router();

const fileUpload = require('../middleware/file-upload')


/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - authenticate
 *     summary: Log in a user
 *     description: Logs in a user and returns a JWT token on successful authentication.
 *     consumes:
 *       - application/json
 *     produces:
 *       - application/json
 *     requestBody:
 *         description: Optional description in *Markdown*
 *         required: true
 *         content:
 *             application/json:
 *              schema:
 *                type: object
 *                required:
 *                  - email
 *                  - password
 *                properties:
 *                  email:
 *                    type: string
 *                    format: email
 *                    example: "user@example.com"
 *                    description: The email address of the user.
 *                  password:
 *                    type: string
 *                    format: password
 *                    example: "123456"
 *                    description: The password of the user.
 *     responses:
 *       200:
 *         description: Successful login
 *         schema:
 *           type: object
 *           properties:
 *             userId:
 *               type: string
 *               example: "648a4b61e3bfb833dd7cf2d9"
 *             email:
 *               type: string
 *               format: email
 *               example: "user@example.com"
 *             token:
 *               type: string
 *               example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0IiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
 *             userRole:
 *               type: string
 *               example: "admin"
 *         examples:
 *           application/json:
 *             userId: "648a4b61e3bfb833dd7cf2d9"
 *             email: "user@example.com"
 *             token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0IiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
 *             userRole: "admin"
 *       401:
 *         description: Invalid credentials
 *         examples:
 *           application/json:
 *             message: "Invalid credentials, could not log you in."
 *       500:
 *         description: Server error
 *         examples:
 *           application/json:
 *             message: "Logging in failed, please try again later."
 *     security: [] 
 */


router.get('/users', authController.getUsers);

router.get('/:userId', authController.getUserById)

router.put('/:userId', fileUpload.single('image'), authController.updateUser)

router.post('/signup', fileUpload.single('image'), authController.signup );

router.post('/login', authController.login);



module.exports = router;
