const mongoose = require('mongoose');
const uniqieValidator = require('mongoose-unique-validator')

const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: { type: String, required: true, minlength: 6 },
  pesel: { type: String, required: true, unique: true },
  surname: { type: String, required: true },
  image: { type: String, required: false },
  role: {
    type: String,
    required: false
  },
  dishCart: {
    items: [
      {
        dishId: {
          type: Schema.Types.ObjectId,
          ref: 'Dish',
          required: true
        },
        quantity: { type: Number, required: true }
      }
    ]
  },
  ingredientCart: {
    items: [
      {
        ingredientTemplateId: {
          type: Schema.Types.ObjectId,
          ref: 'Ingredient-Template',
          required: true
        },
        weight: { type: Number, required: true }
      }
    ]
  }
});

// userSchema.plugin(uniqieValidator)

userSchema.methods.addIngredientToCart = function (ingredientTemplate, weight) {
  console.log("Adding ingredient to cart:", ingredientTemplate, weight);
  const updatedCartItems = [...this.ingredientCart.items];

  updatedCartItems.push({
    ingredientTemplateId: ingredientTemplate,
    weight: weight
  });

  const updatedCart = {
    items: updatedCartItems
  };
  this.ingredientCart = updatedCart;
  return this.save();
};

userSchema.methods.clearDishesCart = function () {
  this.dishCart = { items: [] };
  return this.save();
};

userSchema.methods.addDishToCart = function (dish) {
  const cartDishIndex = this.dishCart.items.findIndex(ci => {
    return ci.dishId.toString() === dish._id.toString();
  });
  let newQuantity = 1;
  const updatedCartItems = [...this.dishCart.items];

  if (cartDishIndex >= 0) {
    newQuantity = this.dishCart.items[cartDishIndex].quantity + 1;
    updatedCartItems[cartDishIndex].quantity = newQuantity;
  } else {
    updatedCartItems.push({
      dishId: dish._id,
      quantity: newQuantity
    });
  }
  const updatedCart = {
    items: updatedCartItems
  };
  this.dishCart = updatedCart;
  return this.save();
};

userSchema.methods.removeDishFromCart = function (dishId) {
  const updatedCartItems = this.dishCart.items.filter(item => {
    return item.dishId.toString() !== dishId.toString();
  });
  this.dishCart.items = updatedCartItems;
  return this.save();
};


userSchema.methods.clearIngredientCart = function () {
  this.ingredientCart = { items: [] };
  return this.save();
};


userSchema.methods.clearCart = function () {
  this.ingredientCart = { items: [] };
  return this.save();
};

userSchema.methods.removeIngredientFromCart = function (ingredientTemplateId) {
  const updatedCartItems = this.ingredientCart.items.filter(item => {
    return item.ingredientTemplateId.toString() !== ingredientTemplateId.toString();
  });
  this.ingredientCart.items = updatedCartItems;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);