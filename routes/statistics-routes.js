const express = require('express');

const router = express.Router();

const statisticsController = require('../controllers/statistics-controller')


router.get('/percentage-stats', statisticsController.getDishPercentage)

router.get('/today-orders', statisticsController.getTodayOrdersCount)

router.get('/today-orders-revenue', statisticsController.getTodayOrdersAndRevenue)

router.get('/users-orders', statisticsController.getUserOrders)

router.get('/users-order-count', statisticsController.getUsersByOrderCount)

router.get('/dish-cost/:dishId', statisticsController.getDishIngredientCost);

router.get('/most-popular-dish', statisticsController.getMostPopularDishesToday)

router.get('/most-used-ingredients', statisticsController.calculateMostUsedIngredients)

router.get('/end-date-ingredient/:ingredientId' ,statisticsController.calculateIngredientEndDate)

router.get('/dishes-left/:dishId', statisticsController.calculateDishesAvailable)

router.get('/ingredient-waste/:ingredientId', statisticsController.calculateIngredientWasteProbability)

router.get('/dish-costs/:dishId' ,statisticsController.calculateAverageIngredientPrices)

router.get('/dish-new-cost/:dishId' ,statisticsController.calculateWithNewDishPrice)

router.get('/dish-count-week/:dishId', statisticsController.getDishOrdersInLast7Days)

router.get('/top-employee', statisticsController.getTopTippedEmployee)

router.get('/test-prediction', statisticsController.calculateMonthlyOrderDifferences)

module.exports = router;