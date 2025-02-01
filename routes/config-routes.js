const express = require('express');
const router = express.Router();
const configController = require('../controllers/config-controller');
const checkAuth = require('../middleware/check-auth');

router.use(checkAuth);

router.get('/tables', configController.getTables);

router.post('/tables', configController.addTable);

router.delete('/tables/:id', configController.deleteTable);

router.put('/tables/:id', configController.updateTable);

router.get('/ingredient-categories', configController.getCategoriesIngredient);

router.post('/ingredient-categories', configController.addIngredientCategory);

router.delete('/ingredient-categories/:categoryId', configController.deleteIngredientCategory);

router.put('/ingredient-categories/:categoryId', configController.updateIngredientCategory);

router.get('/dish-categories', configController.getCategoriesDish);

router.post('/dish-categories', configController.addDishCategory);

router.delete('/dish-categories/:categoryId', configController.deleteDishCategory);

router.put('/dish-categories/:categoryId', configController.updateDishCategory);

module.exports = router;
