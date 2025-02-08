const express = require('express');
const router = express.Router();
const magazineController = require('../controllers/magazine-controller')
const fileUpload = require('../middleware/file-upload')

router.get('/', magazineController.getAllIngredientTemplates)

router.get('/:name', magazineController.getIngredientsByName)

router.post('/create-ingredient-template', fileUpload.single('image'), magazineController.createIngredientTemplate)

router.post('/add-ingredient', magazineController.createIngredient)

router.post('/delete-ingredient', magazineController.moveIngredientToWaste)

router.get('/used-ingredients', magazineController.getZeroWeightIngredients)

router.get('/test-30', magazineController.getDishOrdersLast30Days)

module.exports = router;