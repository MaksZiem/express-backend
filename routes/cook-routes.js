const express = require('express');
const router = express.Router();
const cookController = require('../controllers/cook-controller')
const checkAuth = require('../middleware/check-auth')

router.get('/waiting-orders', cookController.getWaitingOrders)

router.use(checkAuth)

router.patch('/:orderId/dish/:dishName/ready', cookController.markDishAsReady)

router.post('/preparation-time/:cookId', cookController.getCookPreparationTime)

router.post('/dishes-count/:cookId', cookController.getCookDishesCount)

router.post('/dishes/:cookId', cookController.getDishesPreparedByCook)

router.post('/dishes-period/:cookId', cookController.getDishesPreparedByCookWithDateRange)

module.exports = router;
