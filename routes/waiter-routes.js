const express = require('express');
const router = express.Router();
const waiterController = require('../controllers/waiter-controller')
const checkAuth = require('../middleware/check-auth')

router.get('/table-cart/:tableNumber', waiterController.getDishesDashboard)

router.get('/tables', waiterController.getAllTables)

router.post('/add-to-table', waiterController.addDishToTableCart)

router.delete('/delete-from-table', waiterController.removeDishFromTableCart)

router.get('/ready-dishes', waiterController.getReadyDishes)

router.patch('/:orderId/dish/:dishName/delivered', waiterController.markDishAsDelivered)

router.get('/:userId', waiterController.getUserOrdersWithTips);

router.use(checkAuth)

router.post('/add-order', waiterController.postCreateOrder)

router.post('/add-tip', waiterController.addTip)

module.exports = router;