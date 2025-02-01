const express = require('express');

const router = express.Router();

const ingredientStaticsController = require('../controllers/ingredient-statistics-controller')

const checkAuth = require('../middleware/check-auth')

router.use(checkAuth)

router.post('/test4/:ingredientName', ingredientStaticsController.getIngredientUsageByPeriod)

router.post('/test5/:ingredientName', ingredientStaticsController.getIngredientWasteByPeriod)

router.get('/ingredient-waste/:ingredientName', ingredientStaticsController.calculateIngredientWasteProbability)

router.get('/ingredient-niedobor', ingredientStaticsController.niedobor)

router.get('/ingredient-in-dishes/:ingredientName', ingredientStaticsController.getIngredientUsageInDishes)

router.get('/aaa', ingredientStaticsController.getExpiredIngredients)

router.get('/bbb', ingredientStaticsController.getZeroWeightIngredients)

module.exports = router;