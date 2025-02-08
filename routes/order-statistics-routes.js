const express = require('express');
const router = express.Router();
const orderStaticsController = require('../controllers/order-statistics-controller')
const checkAuth = require('../middleware/check-auth')

router.use(checkAuth)

router.post('/most-popular-dish', orderStaticsController.getMostPopularDishes)

router.post('/percentage-stats', orderStaticsController.getDishPercentage)

router.post('/last-week-stats', orderStaticsController.getOrdersStats)

router.post('/total-profit', orderStaticsController.getTotalProfit)

router.post('/by-day-of-week', orderStaticsController.getOrdersByDayOfWeek);

router.post('/orders-with-details', orderStaticsController.getOrdersWithDetails);

module.exports = router;