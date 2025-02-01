const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const dishSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    image: { type: String, required: false },
    category: {
      type: String,
      required: false,
    },
    ingredientTemplates: [
      {
        ingredient: {
          type: Object,
          required: true,
        },
        weight: {
          type: String,
          required: true,
        },
      },
    ],
    isAvailable: {
      type: Boolean,
      required: false,
    },
    isBlocked: {
        type: Boolean,
        required: false
    },
    user: {
      name: {
        type: String,
        required: false,
      },
      userId: {
        type: Schema.Types.ObjectId,
        required: false,
        ref: "User",
      },
    },
  },
  { collection: "Dishes" }
);

module.exports = mongoose.model("Dish", dishSchema);
