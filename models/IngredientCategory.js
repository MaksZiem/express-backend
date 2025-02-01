const mongoose = require('mongoose');

const ingredientCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
  },
  { collection: 'IngredientCategories' } 
);

module.exports = mongoose.model('IngredientCategory', ingredientCategorySchema);
