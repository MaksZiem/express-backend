const express = require('express');

const router = express.Router();

const magazineController = require('../controllers/magazine-controller')

router.get('/', magazineController.getAllIngredientTemplates)

router.get('/:name', magazineController.getIngredientsByName);

router.post('/create-ingredient-template', magazineController.createIngredientTemplate)

router.post('/add-ingredient', magazineController.createIngredient)

module.exports = router;