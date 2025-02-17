const express = require('express');
const router = express.Router();
const dishStaticsController = require('../controllers/dish-statistics-controller')
const fileUpload = require('../middleware/file-upload')
const checkAuth = require('../middleware/check-auth')

router.use(checkAuth)

router.post('/dish-revenue/:dishId', dishStaticsController.getDishRevenueByPeriod)

router.get('/dishes-left/:dishId', dishStaticsController.calculateDishesAvailable)

router.post('/dish-week-days-stats/:dishId', dishStaticsController.getDishPopularity)

router.post('/dish-total/:dishId', dishStaticsController.getDishOrdersStatsByPeriod)

router.post('/dish-revenue-prediction', dishStaticsController.getDishRevenuePrediction)

router.post('/dishes-count', dishStaticsController.dishesCount)

router.put('/update/:dishId', fileUpload.single('image'), dishStaticsController.updateDish)

router.get('/:dishId', dishStaticsController.getDishById)

router.post('/add-ingredient/:dishId' , dishStaticsController.addIngredientToDish)

router.delete('/delete-dish/:dishId', dishStaticsController.deleteDish)

router.post('/:dishId/history', dishStaticsController.getDishRevenueByDateRange)

router.delete('/delete-ingredient/:dishId/:ingredientId', dishStaticsController.deleteIngredient)



module.exports = router;