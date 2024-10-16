const express = require('express');

const router = express.Router();

const dishesController = require('../controllers/dishes-controller')


// router.get('/:pid', dishesController.getDishById)

// router.post('/', dishesController.createDish)

router.get('/dish/:dishId', dishesController.getOrdersByDishId)

router.post('/add-to-cart', dishesController.addDishToCart)

router.delete('/delete-from-cart', dishesController.postDeleteDishFromCart)

router.post('/add-order', dishesController.postCreateOrder)

router.patch('/:pid', dishesController.updateDish)

router.delete('/:pid', dishesController.deleteDish)

router.get('/', dishesController.getDishesDashboard)

router.get('/tables', dishesController.getAllTables)

router.get('/waiting-orders', dishesController.getWaitingOrders)

router.patch('/:orderId/delivered', dishesController.markOrderAsDelivered)

router.post('/add-tip', dishesController.addTip)

router.post('/add-dish-to-table', dishesController.addDishToTableCart)

module.exports = router;