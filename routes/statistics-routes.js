const express = require('express');

const router = express.Router();

const statisticsController = require('../controllers/statistics-controller')


router.get('/percentage-stats', statisticsController.getDishPercentage)

router.get('/today-orders', statisticsController.getTodayOrdersCount)

router.get('/today-orders-revenue', statisticsController.getTodayOrdersAndRevenue)

router.get('/users-orders', statisticsController.getUserOrders)

router.get('/users-order-count', statisticsController.getUsersByOrderCount)

router.get('/dish-cost/:dishId', statisticsController.getDishIngredientCost);

router.get('/most-popular-dish', statisticsController.getMostPopularDishesLastWeek)

router.get('/last-week-stats', statisticsController.getOrdersStatsLastWeek)

router.get('/most-used-ingredients', statisticsController.calculateMostUsedIngredients)

router.get('/end-date-ingredient/:ingredientId' ,statisticsController.calculateIngredientEndDate)

router.get('/dishes-left/:dishId', statisticsController.calculateDishesAvailable)

router.get('/ingredient-waste/:ingredientName', statisticsController.calculateIngredientWasteProbability)

router.get('/ingredient-in-dishes/:ingredientName', statisticsController.getIngredientUsageInDishes)

router.get('/dish-costs/:dishId' ,statisticsController.calculateAverageIngredientPrices)

router.get('/dish-week-days-stats/:dishId', statisticsController.getDishPopularity)

router.post('/dish-new-cost/:dishId' ,statisticsController.calculateWithNewDishPrice)

router.get('/dish-count-week/:dishId', statisticsController.getDishOrdersInLast7Days)

router.get('/top-employee', statisticsController.getTopTippedEmployee)

router.get('/test-prediction', statisticsController.calculateMonthlyOrderDifferences)

router.get('/all-cooks-stats', statisticsController.getDishesCountWithTopCook)

router.get('/prediction-test', statisticsController.calculatePredictionTest)

router.get('/total-week-profit', statisticsController.getTotalProfitLast7Days)

router.post('/simulation/:dishId', statisticsController.calculateWithCustomizations)

router.put('/update-dish/:dishId', statisticsController.updateDish);



const checkAuth = require('../middleware/check-auth')

router.get('/waiters', statisticsController.getWaiters)
router.use(checkAuth)


router.get('/cooks', statisticsController.getCooks)

module.exports = router;