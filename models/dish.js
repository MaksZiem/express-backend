const mongoose = require('mongoose')

const Schema = mongoose.Schema

const dishSchema = new Schema ({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    ingredientTemplates: [{
        ingredient: {
            type: Object,
            required: true
        },
        weight: {
            type: String,
            required: true
        }
    }],
    isAvailable: {
        type: Boolean,
        required: false
    },
    user: {
        name: {
          type: String,
          required: true
        },
        userId: {
          type: Schema.Types.ObjectId,
          required: true,
          ref: 'User'
        }
      }
})

module.exports = mongoose.model('Dish', dishSchema)