const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const ingredientTemplateSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    image: { type: String, required: false },
  },
  { collection: "IngredientTemplates" }
);

module.exports = mongoose.model(
  "Ingredient-Template",
  ingredientTemplateSchema
);
