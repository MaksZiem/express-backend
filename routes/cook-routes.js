const express = require('express');
const router = express.Router();
const cookController = require('../controllers/cook-controller')
const checkAuth = require('../middleware/check-auth')


router.get('/waiting-orders', cookController.getWaitingOrders)

router.use(checkAuth)

router.patch('/:orderId/delivered', cookController.markOrderAsDelivered)

router.patch('/:orderId/dish/:dishName/ready', cookController.markDishAsReady)

router.get('/:cookId', cookController.getDishesPreparedByCook);

router.get('/dishes-count/:cookId', cookController.getDishesCountByCook)

router.get('/dish/:dishId/stats/:cookId', cookController.getUserDishPreparationHistory)

module.exports = router;
