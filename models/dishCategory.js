const mongoose = require('mongoose');

const dishCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
  },
  { collection: 'DishCategories' } 
);

module.exports = mongoose.model('DishCategory', dishCategorySchema);
