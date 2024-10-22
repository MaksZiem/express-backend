const express = require('express');

const router = express.Router();

const cookController = require('../controllers/cook-controller')

router.get('/waiting-orders', cookController.getWaitingOrders)

router.patch('/:orderId/delivered', cookController.markOrderAsDelivered)

router.patch('/:orderId/dish/:dishName/ready', cookController.markDishAsReady)

module.exports = router;
