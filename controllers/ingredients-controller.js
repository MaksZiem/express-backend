const HttpError = require('../models/http-error')
const { validationResult } = require('express-validator')
const Ingredient = require('../models/ingredient');
const IngredientTemplate = require('../models/ingredientTemplate');
const Dish = require('../models/dish')
const jwt = require('jsonwebtoken');
const User = require('../models/user'); // Twój model użytkownika

exports.getIngredientDashboard = (req,res,next) => {
    const {category, name} = req.query;
    // console.log('req.user ingredients: ' + req.userData.userId)
    console.log('userData' + req.userData.userId)
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

// exports.getIngredientDashboard = async (req, res, next) => {
//     const { category, name } = req.query;
  
//     let user;
    
//     // Sprawdź, czy nagłówek autoryzacyjny zawiera token
//     if (req.headers.authorization) {
//       try {
//         const token = req.headers.authorization.split(' ')[1]; // Authorization: 'Bearer TOKEN'
//         if (token) {
//           const decodedToken = jwt.verify(token, 'TOKEN_KEY');
//           user = await User.findById(decodedToken.userId);
//           if (!user) {
//             return next(new HttpError('User not found', 404));
//           }
//           req.user = user;
//         }
//       } catch (err) {
//         // Jeśli token jest niepoprawny, kontynuuj bez użytkownika
//         console.log('Token decoding failed', err);
//       }
//     }
  
//     // Teraz możesz użyć req.user, jeśli użytkownik jest zalogowany
//     if (req.user) {
//       await req.user.populate('ingredientCart.items.ingredientTemplateId');
//     }
    
//     const cartIngredients = req.user ? req.user.ingredientCart.items : [];
  
//     let filterCriteria = {};
  
//     if (category && category !== 'all') {
//       filterCriteria.category = category;
//     }
  
//     if (name) {
//       filterCriteria.name = name;
//     }
  
//     let query = IngredientTemplate.find(filterCriteria);
  
//     query.then(ingredientTemplates => {
//       res.status(200).json({
//         ingredientTemplates: ingredientTemplates.map(template =>
//           template.toObject({ getters: true })
//         ),
//         cartIngredients: cartIngredients.map(cartIngredient =>
//           cartIngredient.toObject({ getters: true })
//         ),
//       });
//     }).catch(err => {
//       console.log(err);
//       return next(new HttpError('Fetching ingredients failed, please try again later.', 500));
//     });
//   };

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

// exports.postIngredientCart = (req, res, next) => {
//     const ingredientTemplateId = req.body.ingredientTemplateId;
//     const weight = req.body.weight;
//     console.log("cos tam" + ingredientTemplateId, weight)
//     IngredientTemplate.findById(ingredientTemplateId)
//         .then(ingredient => {
//             return req.user.addIngredientToCart(ingredient, weight);
//         })
//         .then(result => {
            
//             res.status(200).json({message: "Dodano do koszyka"})
//         });
// };
exports.postIngredientCart = (req, res, next) => {
    console.log('Received data:', req.body); // Sprawdź, co przychodzi na backend
    const ingredientTemplateId = req.body.ingredientTemplateId;
    const weight = req.body.weight;

    if (!ingredientTemplateId || !weight) {
        return res.status(400).json({message: "Brak wymaganych danych"});
    }

    IngredientTemplate.findById(ingredientTemplateId)
        .then(ingredient => {
            if (!ingredient) {
                throw new Error('Ingredient not found');
            }
            return req.user.addIngredientToCart(ingredient, weight);
        })
        .then(result => {
            res.status(200).json({message: "Dodano do koszyka"});
        })
        .catch(err => {
            console.error('Błąd dodawania do koszyka:', err);
            res.status(500).json({message: "Błąd serwera"});
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
                image: req.file.path,
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
