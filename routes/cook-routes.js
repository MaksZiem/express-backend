const express = require('express');
const router = express.Router();
const cookController = require('../controllers/cook-controller')
const checkAuth = require('../middleware/check-auth')

router.get('/waiting-orders', cookController.getWaitingOrders)

router.use(checkAuth)

router.patch('/:orderId/dish/:dishName/ready', cookController.markDishAsReady)

// router.get('/dishes-count/:cookId', cookController.getDishesCountByCook)

router.post('/preparation-time/:cookId', cookController.getCookPreparationTime)

router.post('/dishes-count/:cookId', cookController.getCookDishesCount)

router.post('/test2/:cookId', cookController.getDishesPreparedByCook)

router.post('/dish-prepared-by-cook/:cookId', cookController.getDishesPreparedByCookWithDateRange)

module.exports = router;
