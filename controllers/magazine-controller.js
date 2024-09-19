const HttpError = require('../models/http-error');
const IngredientTemplate = require('../models/ingredientTemplate');
const Ingredient = require('../models/ingredient')
const { validationResult } = require('express-validator');

exports.getAllIngredientTemplates = (req, res, next) => {
    IngredientTemplate.find()
        .then(ingredientTemplates => {
            if (ingredientTemplates.length === 0) {
                return res.status(404).json({ message: 'Nie znaleziono żadnych szablonów składników.' });
            }

          
            res.status(200).json({
                ingredientTemplates: ingredientTemplates.map(ingredientTemplate => ingredientTemplate.toObject({ getters: true }))
            });
        })
        .catch(err => {
            console.error(err);
            return next(new HttpError('Wystąpił błąd podczas pobierania szablonów składników.', 500));
        });
};


exports.getIngredientsByName = async (req, res, next) => {
  const ingredientName = req.params.name; 
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1); 

  try {
      const ingredients = await Ingredient.find({
          name: ingredientName,
          addedDate: { $gte: oneYearAgo }
      }).sort({ expirationDate: -1 }); 

      if (ingredients.length === 0) {
          return res.status(404).json({ message: 'Nie znaleziono żadnych składników o podanej nazwie w ciągu ostatnich 365 dni.' });
      }

      console.log('Składniki znalezione w ciągu ostatnich 365 dni:', ingredients);

      let totalExpirationTime = 0;
      ingredients.forEach(ingredient => {
          const expirationDate = new Date(ingredient.expirationDate).getTime();
          const addedDate = new Date(ingredient.addedDate).getTime();
          const averageExpirationTime = (expirationDate + addedDate) / 2;

          console.log(`Składnik: ${ingredient.name}`);
          console.log(`  Data ważności: ${expirationDate}`);
          console.log(`  Data dodania: ${addedDate}`);
          console.log(`  Średni czas ważności: ${averageExpirationTime}`);

          totalExpirationTime += averageExpirationTime;
      });

      const averageExpirationDate = new Date(totalExpirationTime / ingredients.length).toISOString().slice(0, 10);

      console.log('Średnia data ważności:', averageExpirationDate);

      res.status(200).json({
          averageExpirationDate: averageExpirationDate, 
          ingredients: ingredients.map(ingredient => ({
              ...ingredient.toObject({ getters: true }),
              expirationDate: ingredient.expirationDate.toISOString().slice(0, 10) 
          }))
      });
  } catch (err) {
      console.error(err);
      return next(new HttpError('Wystąpił błąd podczas pobierania składników.', 500));
  }
};

exports.createIngredientTemplate = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new HttpError('Invalid inputs passed, please check your data.', 422));
    }
  
    const { name, category, expirationDate } = req.body;
  
    const dateObject = new Date(expirationDate);
    const day = dateObject.getDate().toString().padStart(2, '0');
    const month = (dateObject.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObject.getFullYear();
  
    const formattedExpirationDate = `${day}-${month}-${year}`;
  
    const createdIngredientTemplate = new IngredientTemplate({
      name,
      category,
      expirationDate: expirationDate, 
    });
  
    try {
      await createdIngredientTemplate.save();
    } catch (err) {
      const error = new HttpError(
        'Creating ingredient template failed, please try again later.',
        500
      );
      console.log(err)
      return next(error);
    }
  
    res.status(201).json({ ingredientTemplate: createdIngredientTemplate.toObject({ getters: true }) });
  };
  
  exports.createIngredient = async (req, res, next) => {
    const { name, category, expirationDate, weight, price } = req.body;

    if (!name || !category || !expirationDate || !weight || !price) {
        return res.status(400).json({ message: 'Wszystkie pola są wymagane.' });
    }

    const newIngredient = new Ingredient({
        name,
        category,
        expirationDate: new Date(expirationDate), 
        weight,
        price,
        addedDate: new Date() 
    });

    try {
        await newIngredient.save();
        res.status(201).json({ message: 'Ingredient template added successfully!' });
    } catch (err) {
        console.log(err);
        const error = new HttpError('Adding ingredient template failed.', 500);
        return next(error);
    }
};
  

