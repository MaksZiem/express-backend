const express = require('express');

const router = express.Router();

const waiterController = require('../controllers/waiter-controller')


router.get('/table-cart/:tableNumber', waiterController.getDishesDashboard)

router.post('/add-order', waiterController.postCreateOrder)

router.get('/tables', waiterController.getAllTables)

router.post('/add-tip', waiterController.addTip)

router.post('/add-to-table', waiterController.addDishToTableCart)

router.delete('/delete-from-table', waiterController.removeDishFromTableCart)

router.get('/ready-dishes', waiterController.getReadyDishes)

router.patch('/:orderId/dish/:dishName/delivered', waiterController.markDishAsDelivered)

module.exports = router;