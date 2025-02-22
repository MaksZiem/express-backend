const express = require('express');

const router = express.Router();

const ingredientStaticsController = require('../controllers/ingredient-statistics-controller')

const checkAuth = require('../middleware/check-auth')

router.use(checkAuth)

router.post('/usage/:ingredientName', ingredientStaticsController.getIngredientUsageByPeriod)

router.post('/waste/:ingredientName', ingredientStaticsController.getIngredientWasteByPeriod)

router.get('/waste-propability/:ingredientName', ingredientStaticsController.calculateIngredientWasteProbability)

router.get('/deficiency', ingredientStaticsController.getDeficiency)

router.get('/ingredient-in-dishes/:ingredientName', ingredientStaticsController.getIngredientUsageInDishes)

router.get('/expired', ingredientStaticsController.getExpiredIngredients)

router.get('/zero-weight', ingredientStaticsController.getZeroWeightIngredients)

module.exports = router;