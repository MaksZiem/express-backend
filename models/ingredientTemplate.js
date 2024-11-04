const mongoose = require('mongoose')

const Schema = mongoose.Schema;

const ingredientTemplateSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    expirationDate: {
        type: Date,
        required: false
    },
    category: {
        type: String,
        required: true
    },
    image: { type: String, required: false },
})

module.exports = mongoose.model('Ingredient-Template', ingredientTemplateSchema)