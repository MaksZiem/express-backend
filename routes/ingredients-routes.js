const express = require('express');

const router = express.Router();

const ingredientsController = require('../controllers/ingredients-controller')


router.get('/', ingredientsController.getIngredientDashboard)

router.get('/weight-checkout', ingredientsController.getIngredientWeightCheckout)

router.post('/add-to-cart', ingredientsController.postIngredientCart)

router.delete('/delete-from-cart', ingredientsController.postDeleteIngredientFromCart)

router.post('/add-dish', ingredientsController.postCreateDish)

module.exports = router;