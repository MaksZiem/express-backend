const mongoose = require('mongoose')

const Schema = mongoose.Schema;

const ingredientWasteSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    weight: {
        type: Number,
        required: true
    },
    addedDate: {
        type: Date,
        required: false
    },
    expirationDate: {
        type: Date,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    priceRatio: {
        type: Number,
        required: false
    }
})

module.exports = mongoose.model('Ingredient-Waste', ingredientWasteSchema)