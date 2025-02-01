const express = require('express');
const router = express.Router();
const ingredientsController = require('../controllers/ingredients-controller')
const checkAuth = require('../middleware/check-auth')
const fileUpload = require('../middleware/file-upload')

router.use(checkAuth)

// router.get('/', ingredientsController.getIngredientDashboard)

// router.get('/magazine', ingredientsController.getIngredientDashboardMagazine)

// router.delete('/delete-from-cart', ingredientsController.postDeleteIngredientFromCart)

// router.get('/weight-checkout', ingredientsController.getIngredientWeightCheckout)

// router.post('/add-to-cart', ingredientsController.postIngredientCart)

// router.delete('/delete-ingredient-template', ingredientsController.postDeleteIngredientTemplate)

// router.delete('/delete-ingredient', ingredientsController.postDeleteIngredient)

// router.post('/add-dish', fileUpload.single('image'), ingredientsController.postCreateDish)

/**
 * @swagger
 * tags:
 *   - name: Ingredients
 *     description: Operations related to ingredients.
 */

/**
 * @swagger
 * securityDefinitions:
 *   bearerAuth:
 *     type: apiKey
 *     name: Authorization
 *     in: header
 *     description: Provide the JWT token as "Bearer <your-token>"
 */

/**
 * @swagger
 * security:
 *   - bearerAuth: []
 */

/**
 * @swagger
 * /api/ingredients:
 *   get:
 *     tags:
 *       - Ingredients
 *     summary: Get ingredient dashboard
 *     description: Retrieve ingredients based on filters.
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by ingredient category.
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by ingredient name.
 *     responses:
 *       200:
 *         description: A list of ingredients by category and cart items.
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Błąd serwera."
 *     security:
 *       - bearerAuth: []  
 */
router.get('/', ingredientsController.getIngredientDashboard);

router.get('/magazine', ingredientsController.getIngredientDashboardMagazine);

router.get('/weight-checkout', ingredientsController.getIngredientWeightCheckout);

router.post('/add-to-cart', ingredientsController.postIngredientCart);

router.delete('/delete-from-cart', ingredientsController.postDeleteIngredientFromCart);

router.delete('/delete-ingredient-template', ingredientsController.postDeleteIngredientTemplate);

router.delete('/delete-ingredient', ingredientsController.postDeleteIngredient);

router.post('/add-dish', fileUpload.single('image'), ingredientsController.postCreateDish);



module.exports = router;