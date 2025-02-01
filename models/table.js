const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const tableSchema = new Schema({
    number: {
        type: Number,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['free', 'waiting', 'delivered'],
        default: 'free'
    },
    order: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    dishCart: {
        items: [
          {
            dishId: {
              type: Schema.Types.ObjectId,
              ref: 'Dish',
              required: false
            },
            quantity: { type: Number, required: false },
            status: {
              type: String,
              enum: ['taken', 'notTaken'],
              default: 'notTaken'
            }
          }
        ]
      },
      usedIngredients: [
        {
          ingredientId: {
            type: Schema.Types.ObjectId,
            ref: 'Ingredient',
            required: true
          },
          amount: {
            type: Number,
            required: true
          }
        }
      ]
},
{ collection: "Tables" });

module.exports = mongoose.model('Table', tableSchema);
