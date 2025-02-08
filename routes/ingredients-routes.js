const express = require('express');
const router = express.Router();
const ingredientsController = require('../controllers/ingredients-controller')
const checkAuth = require('../middleware/check-auth')
const fileUpload = require('../middleware/file-upload')

router.use(checkAuth)

router.get('/', ingredientsController.getIngredientDashboard);

router.get('/magazine', ingredientsController.getIngredientDashboardMagazine);

router.get('/weight-checkout', ingredientsController.getIngredientWeightCheckout);

router.post('/add-to-cart', ingredientsController.postIngredientCart);

router.delete('/delete-from-cart', ingredientsController.postDeleteIngredientFromCart);

router.delete('/delete-ingredient-template', ingredientsController.postDeleteIngredientTemplate);

router.delete('/delete-ingredient', ingredientsController.postDeleteIngredient);

router.post('/add-dish', fileUpload.single('image'), ingredientsController.postCreateDish);



module.exports = router;