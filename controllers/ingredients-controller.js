const HttpError = require('../models/http-error')
const { validationResult } = require('express-validator')
const Ingredient = require('../models/ingredient');
const IngredientTemplate = require('../models/ingredientTemplate');
const Dish = require('../models/dish')

exports.getIngredientDashboard = (req,res,next) => {
    const {category, name} = req.query;
    console.log(name)
    req.user
        .populate('ingredientCart.items.ingredientTemplateId')
        .then(user => {
            const cartIngredients = user.ingredientCart.items;
            let filterCriteria = {};

            if (category && category !== 'all') {
                filterCriteria.category = category;
            }

            if (name) {
                filterCriteria.name = name;
            }

            let query = IngredientTemplate.find()

            if (Object.keys(filterCriteria).length > 0) {
                query = IngredientTemplate.find(filterCriteria)
            }

            query.then(ingredientTemplates => {
                res.status(200).json({
                    ingredientTemplates: ingredientTemplates.map(ingredientTemplates => ingredientTemplates.toObject({getters: true})),
                    cartIngredients: cartIngredients.map(cartIngredients => cartIngredients.toObject({getters: true}))
                })
            })

        }).catch(err => {
            console.log(err)
        })
} 

exports.getIngredientWeightCheckout = (req, res, next) => {
    const ingredientTemplateId = req.body.ingredientTemplateId;
    IngredientTemplate.findById(ingredientTemplateId)
        .then(ingredientTemplate => {

            if (!ingredientTemplate) {
                const error = HttpError('Could not find a ingredientTemplate for the provided id.', 404);
                return next(error)
            }
            
            console.log("A" + ingredientTemplate)

            res.status(200).json({
                ingredientTemplate: ingredientTemplate,
                isAuthenticated: req.session.isLoggedIn
            })
        }).catch(err => {
            console.log(err)
        })
};

exports.postIngredientCart = (req, res, next) => {
    const ingredientTemplateId = req.body.ingredientTemplateId;
    const weight = req.body.weight;
    console.log("cos tam" + ingredientTemplateId, weight)
    IngredientTemplate.findById(ingredientTemplateId)
        .then(ingredient => {
            return req.user.addIngredientToCart(ingredient, weight);
        })
        .then(result => {
            
            res.status(200).json({message: "Dodano do koszyka"})
        });
};

exports.postDeleteIngredientFromCart = (req, res, next) => {
    const prodId = req.body.ingredientTemplateId;
    req.user
        .removeIngredientFromCart(prodId)
        .then(result => {
            res.status(200).json({message: "all is okay"})
        })
        .catch(err => console.log(err));
};

exports.postCreateDish = (req, res, next) => {
    const name = req.body.name;
    const price = req.body.price;
    req.user
        .populate('ingredientCart.items.ingredientTemplateId')
        .then(user => {
            const ingredients = user.ingredientCart.items.map(i => {
                return { weight: i.weight, ingredient: { ...i.ingredientTemplateId._doc } };
            });
            const dish = new Dish({
                name: name,
                price: price,
                user: {
                    name: req.user.name,
                    userId: req.user
                },
                ingredientTemplates: ingredients
            });
            return dish.save();
        })
        .then(result => {
            return req.user.clearIngredientCart();
        })
        .then(() => {
            res.status(200).json({message: "git"})
        })
        .catch(err => console.log(err));
};
