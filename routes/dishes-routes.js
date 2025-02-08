const express = require('express');
const router = express.Router();
const dishesController = require('../controllers/dishes-controller')

router.get('/', dishesController.getDishes)

router.get('/dish/:dishId', dishesController.getOrdersByDishId)

router.post('/add-to-cart', dishesController.addDishToCart)

router.patch('/:pid', dishesController.updateDish)

router.delete('/:pid', dishesController.deleteDish)



module.exports = router;